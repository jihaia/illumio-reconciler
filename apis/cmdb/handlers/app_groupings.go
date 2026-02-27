package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var ListAppGroupings = listHandler("app_groupings", "name", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("name", q)
	}
	if aid := c.Query("asset_id"); aid != "" {
		qb.addFilter("asset_id = ?", aid)
	}
})

var GetAppGrouping = getHandler("app_groupings")
var DeleteAppGrouping = deleteHandler("app_groupings")

func CreateAppGrouping(c *gin.Context) {
	var input struct {
		Name        string  `json:"name" binding:"required"`
		AssetID     int64   `json:"asset_id" binding:"required"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := getDB().ExecContext(c,
		"INSERT INTO app_groupings (name, asset_id, description) VALUES (?, ?, ?)",
		input.Name, input.AssetID, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	row, err := scanRow(getDB(), c, "SELECT * FROM app_groupings WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func UpdateAppGrouping(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var input struct {
		Name        *string `json:"name"`
		AssetID     *int64  `json:"asset_id"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		`UPDATE app_groupings SET
			name=COALESCE(?,name), asset_id=COALESCE(?,asset_id),
			description=COALESCE(?,description), updated_at=datetime('now')
		 WHERE id=?`,
		input.Name, input.AssetID, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM app_groupings WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
