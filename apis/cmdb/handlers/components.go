package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var ListComponents = listHandler("components", "name", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("name", q)
	}
	if aid := c.Query("application_id"); aid != "" {
		qb.addFilter("application_id = ?", aid)
	}
	if tid := c.Query("type_id"); tid != "" {
		qb.addFilter("component_type_id = ?", tid)
	}
})

var GetComponent = getHandler("components")
var DeleteComponent = deleteHandler("components")

func CreateComponent(c *gin.Context) {
	var input struct {
		Name            string  `json:"name" binding:"required"`
		ApplicationID   int64   `json:"application_id" binding:"required"`
		ComponentTypeID *int64  `json:"component_type_id"`
		SnowSysId       *string `json:"snow_sys_id"`
		Description     *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := getDB().ExecContext(c,
		`INSERT INTO components (name, application_id, component_type_id, snow_sys_id, description)
		 VALUES (?, ?, ?, ?, ?)`,
		input.Name, input.ApplicationID, input.ComponentTypeID, input.SnowSysId, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	row, err := scanRow(getDB(), c, "SELECT * FROM components WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func UpdateComponent(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var input struct {
		Name            *string `json:"name"`
		ApplicationID   *int64  `json:"application_id"`
		ComponentTypeID *int64  `json:"component_type_id"`
		SnowSysId       *string `json:"snow_sys_id"`
		Description     *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		`UPDATE components SET
			name=COALESCE(?,name), application_id=COALESCE(?,application_id),
			component_type_id=COALESCE(?,component_type_id), snow_sys_id=COALESCE(?,snow_sys_id),
			description=COALESCE(?,description), updated_at=datetime('now')
		 WHERE id=?`,
		input.Name, input.ApplicationID, input.ComponentTypeID, input.SnowSysId, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM components WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
