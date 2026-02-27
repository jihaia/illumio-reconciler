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
	if name := c.Query("name"); name != "" {
		qb.addFilter("name = ?", name)
	}
})

var GetAppGrouping = getByPK("app_groupings", "app_grouping_id")
var DeleteAppGrouping = deleteByPK("app_groupings", "app_grouping_id")

func CreateAppGrouping(c *gin.Context) {
	var input struct {
		Name        string  `json:"name" binding:"required"`
		AssetID     string  `json:"asset_id" binding:"required"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := newUUID()
	_, err := getDB().ExecContext(c,
		"INSERT INTO app_groupings (app_grouping_id, name, asset_id, description) VALUES (?, ?, ?, ?)",
		id, input.Name, input.AssetID, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM app_groupings WHERE app_grouping_id = ?", id)
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
		AssetID     *string `json:"asset_id"`
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
		 WHERE app_grouping_id=?`,
		input.Name, input.AssetID, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM app_groupings WHERE app_grouping_id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
