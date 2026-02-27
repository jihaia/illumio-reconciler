package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ListComponentWorkloads returns all workloads linked to a component.
func ListComponentWorkloads(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	rows, err := getDB().QueryContext(c,
		`SELECT w.*
		 FROM workloads w
		 JOIN component_workloads cw ON cw.workload_id = w.workload_id
		 WHERE cw.component_id = ?
		 ORDER BY w.hostname`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	results, err := scanRows(rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if results == nil {
		results = []map[string]any{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  results,
		"count": len(results),
	})
}

// LinkWorkload creates a component-workload association.
func LinkWorkload(c *gin.Context) {
	componentID, ok := idParam(c)
	if !ok {
		return
	}

	var input struct {
		WorkloadID string `json:"workload_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		"INSERT OR IGNORE INTO component_workloads (component_id, workload_id) VALUES (?, ?)",
		componentID, input.WorkloadID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"linked": true})
}

// UnlinkWorkload removes a component-workload association.
func UnlinkWorkload(c *gin.Context) {
	componentID := c.Param("id")
	workloadID := c.Param("workload_id")
	if componentID == "" || workloadID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "component_id and workload_id required"})
		return
	}

	result, err := getDB().ExecContext(c,
		"DELETE FROM component_workloads WHERE component_id = ? AND workload_id = ?",
		componentID, workloadID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "link not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
