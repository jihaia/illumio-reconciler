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
	if name := c.Query("name"); name != "" {
		qb.addFilter("name = ?", name)
	}
})

var GetApplication = getByPK("applications", "application_id")
var DeleteApplication = deleteByPK("applications", "application_id")

func CreateApplication(c *gin.Context) {
	var input struct {
		Name          string  `json:"name" binding:"required"`
		AppGroupingID string  `json:"app_grouping_id" binding:"required"`
		Description   *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := newUUID()
	_, err := getDB().ExecContext(c,
		"INSERT INTO applications (application_id, name, app_grouping_id, description) VALUES (?, ?, ?, ?)",
		id, input.Name, input.AppGroupingID, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM applications WHERE application_id = ?", id)
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
		AppGroupingID *string `json:"app_grouping_id"`
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
		 WHERE application_id=?`,
		input.Name, input.AppGroupingID, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM applications WHERE application_id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
