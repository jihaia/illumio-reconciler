package handlers

import "github.com/gin-gonic/gin"

var ListComponentTypes = listHandler("component_types", "label", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("label", q)
	}
	if classID := c.Query("class_id"); classID != "" {
		qb.addFilter("component_class_id = ?", classID)
	}
})

var GetComponentType = getByPK("component_types", "component_type_id")
