package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var ListComponents = listHandler("components", "created_at", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("name", q)
	}
	if aid := c.Query("application_id"); aid != "" {
		qb.addFilter("application_id = ?", aid)
	}
	if tid := c.Query("type_id"); tid != "" {
		qb.addFilter("component_type_id = ?", tid)
	}
	if cid := c.Query("class_id"); cid != "" {
		qb.addFilter("component_class_id = ?", cid)
	}
	if name := c.Query("name"); name != "" {
		qb.addFilter("name = ?", name)
	}
})

var GetComponent = getByPK("components", "component_id")
var DeleteComponent = deleteByPK("components", "component_id")

func CreateComponent(c *gin.Context) {
	var input struct {
		Name             *string `json:"name"`
		ApplicationID    string  `json:"application_id" binding:"required"`
		ComponentClassID *string `json:"component_class_id"`
		ComponentTypeID  *string `json:"component_type_id"`
		SnowSysId        *string `json:"snow_sys_id"`
		Description      *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := newUUID()
	_, err := getDB().ExecContext(c,
		`INSERT INTO components (component_id, name, application_id, component_class_id, component_type_id, snow_sys_id, description)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, input.Name, input.ApplicationID, input.ComponentClassID, input.ComponentTypeID, input.SnowSysId, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM components WHERE component_id = ?", id)
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
		Name             *string `json:"name"`
		ApplicationID    *string `json:"application_id"`
		ComponentClassID *string `json:"component_class_id"`
		ComponentTypeID  *string `json:"component_type_id"`
		SnowSysId        *string `json:"snow_sys_id"`
		Description      *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		`UPDATE components SET
			name=COALESCE(?,name), application_id=COALESCE(?,application_id),
			component_class_id=COALESCE(?,component_class_id), component_type_id=COALESCE(?,component_type_id),
			snow_sys_id=COALESCE(?,snow_sys_id), description=COALESCE(?,description),
			updated_at=datetime('now')
		 WHERE component_id=?`,
		input.Name, input.ApplicationID, input.ComponentClassID, input.ComponentTypeID, input.SnowSysId, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM components WHERE component_id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
