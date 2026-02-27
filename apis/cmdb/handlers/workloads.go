package handlers

import (
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

var GetWorkload = getHandler("workloads")
var DeleteWorkload = deleteHandler("workloads")

func CreateWorkload(c *gin.Context) {
	var input struct {
		Hostname    string  `json:"hostname" binding:"required"`
		SnowSysId   *string `json:"snow_sys_id"`
		IPAddress   *string `json:"ip_address"`
		FQDN        *string `json:"fqdn"`
		OS          *string `json:"os"`
		Environment *string `json:"environment"`
		ClassType   *string `json:"class_type"`
		IsVirtual   *int    `json:"is_virtual"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := getDB().ExecContext(c,
		`INSERT INTO workloads (hostname, snow_sys_id, ip_address, fqdn, os, environment, class_type, is_virtual, description)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Hostname, input.SnowSysId, input.IPAddress, input.FQDN, input.OS,
		input.Environment, input.ClassType, input.IsVirtual, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	row, err := scanRow(getDB(), c, "SELECT * FROM workloads WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, row)
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
			class_type=COALESCE(?,class_type), is_virtual=COALESCE(?,is_virtual),
			description=COALESCE(?,description), updated_at=datetime('now')
		 WHERE id=?`,
		input.Hostname, input.SnowSysId, input.IPAddress, input.FQDN,
		input.OS, input.Environment, input.ClassType, input.IsVirtual, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM workloads WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
