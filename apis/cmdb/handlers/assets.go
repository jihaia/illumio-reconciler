package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var ListAssets = listHandler("assets", "name", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("name", q)
	}
	if pid := c.Query("portfolio_id"); pid != "" {
		qb.addFilter("portfolio_id = ?", pid)
	}
	if name := c.Query("name"); name != "" {
		qb.addFilter("name = ?", name)
	}
})

var GetAsset = getByPK("assets", "asset_id")
var DeleteAsset = deleteByPK("assets", "asset_id")

func CreateAsset(c *gin.Context) {
	var input struct {
		Name           string  `json:"name" binding:"required"`
		PortfolioID    string  `json:"portfolio_id" binding:"required"`
		SnowSysId      *string `json:"snow_sys_id"`
		FullName       *string `json:"full_name"`
		Description    *string `json:"description"`
		Criticality    *string `json:"criticality"`
		Environment    *string `json:"environment"`
		Category       *string `json:"category"`
		Infrastructure *string `json:"infrastructure"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := newUUID()
	_, err := getDB().ExecContext(c,
		`INSERT INTO assets (asset_id, name, portfolio_id, snow_sys_id, full_name, description, criticality, environment, category, infrastructure)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, input.Name, input.PortfolioID, input.SnowSysId, input.FullName, input.Description,
		input.Criticality, input.Environment, input.Category, input.Infrastructure)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM assets WHERE asset_id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func UpdateAsset(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var input struct {
		Name           *string `json:"name"`
		PortfolioID    *string `json:"portfolio_id"`
		SnowSysId      *string `json:"snow_sys_id"`
		FullName       *string `json:"full_name"`
		Description    *string `json:"description"`
		Criticality    *string `json:"criticality"`
		Environment    *string `json:"environment"`
		Category       *string `json:"category"`
		Infrastructure *string `json:"infrastructure"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		`UPDATE assets SET
			name=COALESCE(?,name), portfolio_id=COALESCE(?,portfolio_id),
			snow_sys_id=COALESCE(?,snow_sys_id), full_name=COALESCE(?,full_name),
			description=COALESCE(?,description), criticality=COALESCE(?,criticality),
			environment=COALESCE(?,environment), category=COALESCE(?,category),
			infrastructure=COALESCE(?,infrastructure), updated_at=datetime('now')
		 WHERE asset_id=?`,
		input.Name, input.PortfolioID, input.SnowSysId, input.FullName,
		input.Description, input.Criticality, input.Environment, input.Category,
		input.Infrastructure, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM assets WHERE asset_id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
