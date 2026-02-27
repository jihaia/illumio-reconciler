package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var ListApplications = listHandler("applications", "name", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("name", q)
	}
	if gid := c.Query("app_grouping_id"); gid != "" {
		qb.addFilter("app_grouping_id = ?", gid)
	}
})

var GetApplication = getHandler("applications")
var DeleteApplication = deleteHandler("applications")

func CreateApplication(c *gin.Context) {
	var input struct {
		Name           string  `json:"name" binding:"required"`
		AppGroupingID  int64   `json:"app_grouping_id" binding:"required"`
		Description    *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := getDB().ExecContext(c,
		"INSERT INTO applications (name, app_grouping_id, description) VALUES (?, ?, ?)",
		input.Name, input.AppGroupingID, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	row, err := scanRow(getDB(), c, "SELECT * FROM applications WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func UpdateApplication(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var input struct {
		Name          *string `json:"name"`
		AppGroupingID *int64  `json:"app_grouping_id"`
		Description   *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		`UPDATE applications SET
			name=COALESCE(?,name), app_grouping_id=COALESCE(?,app_grouping_id),
			description=COALESCE(?,description), updated_at=datetime('now')
		 WHERE id=?`,
		input.Name, input.AppGroupingID, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM applications WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
