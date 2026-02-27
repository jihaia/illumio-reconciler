package handlers

import "github.com/gin-gonic/gin"

var ListComponentClasses = listHandler("component_classes", "label", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("label", q)
	}
})

var GetComponentClass = getByPK("component_classes", "component_class_id")
