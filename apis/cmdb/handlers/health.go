package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jihaia/aperture/apis/cmdb/db"
)

func Health(c *gin.Context) {
	err := db.DB().PingContext(c)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"db_path": db.Path(),
	})
}

func Schema(c *gin.Context) {
	rows, err := db.DB().QueryContext(c,
		"SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type table struct {
		Name string `json:"name"`
		SQL  string `json:"sql"`
	}
	var tables []table
	for rows.Next() {
		var t table
		if err := rows.Scan(&t.Name, &t.SQL); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		tables = append(tables, t)
	}
	c.JSON(http.StatusOK, gin.H{"tables": tables})
}
