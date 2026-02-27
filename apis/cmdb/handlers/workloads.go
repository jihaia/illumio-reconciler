package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

var ListWorkloads = listHandler("workloads", "hostname", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("hostname", q)
	}
	if hostname := c.Query("hostname"); hostname != "" {
		qb.addFilter("hostname = ?", hostname)
	}
	if ip := c.Query("ip"); ip != "" {
		qb.addFilter("ip_address = ?", ip)
	}
})

var GetWorkload = getByPK("workloads", "workload_id")
var DeleteWorkload = deleteByPK("workloads", "workload_id")

func CreateWorkload(c *gin.Context) {
	var input struct {
		Hostname    string  `json:"hostname" binding:"required"`
		SnowSysId   *string `json:"snow_sys_id"`
		IPAddress   *string `json:"ip_address"`
		FQDN        *string `json:"fqdn"`
		OS          *string `json:"os"`
		Environment *string `json:"environment"`
		Location    *string `json:"location"`
		ClassType   *string `json:"class_type"`
		IsVirtual   *int    `json:"is_virtual"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := newUUID()
	_, err := getDB().ExecContext(c,
		`INSERT INTO workloads (workload_id, hostname, snow_sys_id, ip_address, fqdn, os, environment, location, class_type, is_virtual, description)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, input.Hostname, input.SnowSysId, input.IPAddress, input.FQDN, input.OS,
		input.Environment, input.Location, input.ClassType, input.IsVirtual, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM workloads WHERE workload_id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func BulkUpsertWorkloads(c *gin.Context) {
	var input struct {
		Workloads []struct {
			Hostname    string  `json:"hostname"`
			IPAddress   *string `json:"ip_address"`
			FQDN        *string `json:"fqdn"`
			OS          *string `json:"os"`
			Environment *string `json:"environment"`
			Location    *string `json:"location"`
			ClassType   *string `json:"class_type"`
			IsVirtual   *int    `json:"is_virtual"`
			Description *string `json:"description"`
		} `json:"workloads" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := getDB().BeginTx(c, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(c,
		`INSERT INTO workloads (workload_id, hostname, ip_address, fqdn, os, environment, location, class_type, is_virtual, description)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(hostname) DO UPDATE SET
		   ip_address=COALESCE(excluded.ip_address, ip_address),
		   fqdn=COALESCE(excluded.fqdn, fqdn),
		   os=COALESCE(excluded.os, os),
		   environment=COALESCE(excluded.environment, environment),
		   location=COALESCE(excluded.location, location),
		   class_type=COALESCE(excluded.class_type, class_type),
		   is_virtual=COALESCE(excluded.is_virtual, is_virtual),
		   description=COALESCE(excluded.description, description),
		   updated_at=datetime('now')`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer stmt.Close()

	// Pre-load existing hostnames for created vs updated tracking
	existingHostnames := map[string]bool{}
	rows, err := tx.QueryContext(c, "SELECT hostname FROM workloads")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var h string
			rows.Scan(&h)
			existingHostnames[h] = true
		}
	}

	created, updated, errors := 0, 0, 0
	for _, w := range input.Workloads {
		if w.Hostname == "" {
			errors++
			continue
		}

		_, err := stmt.ExecContext(c,
			newUUID(), w.Hostname, w.IPAddress, w.FQDN, w.OS,
			w.Environment, w.Location, w.ClassType, w.IsVirtual, w.Description)
		if err != nil {
			errors++
			continue
		}
		if existingHostnames[w.Hostname] {
			updated++
		} else {
			created++
			existingHostnames[w.Hostname] = true
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"created": created,
		"updated": updated,
		"errors":  errors,
		"total":   len(input.Workloads),
	})
}

// LookupWorkload finds a workload by hostname or IP and returns it with
// its full hierarchy: components → applications → app_groupings → assets → portfolios.
func LookupWorkload(c *gin.Context) {
	hostname := c.Query("hostname")
	ip := c.Query("ip")

	if hostname == "" && ip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hostname or ip required"})
		return
	}

	// Find the workload
	var query string
	var arg string
	if hostname != "" {
		query = "SELECT * FROM workloads WHERE hostname = ?"
		arg = hostname
	} else {
		query = "SELECT * FROM workloads WHERE ip_address = ?"
		arg = ip
	}

	workload, err := scanRow(getDB(), c, query, arg)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"workload": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	workloadID := workload["workload_id"]

	// Fetch linked components via junction table, with full hierarchy
	rows, err := getDB().QueryContext(c,
		`SELECT c.component_id, c.name AS component_name, c.description AS component_description,
		        ct.label AS component_type, ct.color AS component_color,
		        a.application_id, a.name AS application_name,
		        ag.app_grouping_id, ag.name AS app_grouping_name,
		        ast.asset_id, ast.name AS asset_name, ast.criticality, ast.environment AS asset_environment,
		        p.portfolio_id, p.name AS portfolio_name
		 FROM component_workloads cw
		 JOIN components c ON c.component_id = cw.component_id
		 LEFT JOIN component_types ct ON ct.component_type_id = c.component_type_id
		 JOIN applications a ON a.application_id = c.application_id
		 JOIN app_groupings ag ON ag.app_grouping_id = a.app_grouping_id
		 JOIN assets ast ON ast.asset_id = ag.asset_id
		 JOIN portfolios p ON p.portfolio_id = ast.portfolio_id
		 WHERE cw.workload_id = ?
		 ORDER BY p.name, ast.name, a.name, c.name`, workloadID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	hierarchy, err := scanRows(rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if hierarchy == nil {
		hierarchy = []map[string]any{}
	}

	c.JSON(http.StatusOK, gin.H{
		"workload":  workload,
		"hierarchy": hierarchy,
	})
}

func UpdateWorkload(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var input struct {
		Hostname    *string `json:"hostname"`
		SnowSysId   *string `json:"snow_sys_id"`
		IPAddress   *string `json:"ip_address"`
		FQDN        *string `json:"fqdn"`
		OS          *string `json:"os"`
		Environment *string `json:"environment"`
		Location    *string `json:"location"`
		ClassType   *string `json:"class_type"`
		IsVirtual   *int    `json:"is_virtual"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		`UPDATE workloads SET
			hostname=COALESCE(?,hostname), snow_sys_id=COALESCE(?,snow_sys_id),
			ip_address=COALESCE(?,ip_address), fqdn=COALESCE(?,fqdn),
			os=COALESCE(?,os), environment=COALESCE(?,environment),
			location=COALESCE(?,location),
			class_type=COALESCE(?,class_type), is_virtual=COALESCE(?,is_virtual),
			description=COALESCE(?,description), updated_at=datetime('now')
		 WHERE workload_id=?`,
		input.Hostname, input.SnowSysId, input.IPAddress, input.FQDN,
		input.OS, input.Environment, input.Location, input.ClassType, input.IsVirtual, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM workloads WHERE workload_id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
