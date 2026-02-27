package handlers

import "github.com/gin-gonic/gin"

var ListComponentTypes = listHandler("component_types", "label", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("label", q)
	}
})

var GetComponentType = getHandler("component_types")
