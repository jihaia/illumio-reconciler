package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/jihaia/aperture/apis/cmdb/handlers"
)

func NewRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.SetTrustedProxies(nil)

	// CORS for local extension development
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	v1 := r.Group("/v1/cmdb")
	{
		v1.GET("/health", handlers.Health)
		v1.GET("/schema", handlers.Schema)

		// Portfolios
		v1.GET("/portfolios", handlers.ListPortfolios)
		v1.POST("/portfolios", handlers.CreatePortfolio)
		v1.GET("/portfolios/:id", handlers.GetPortfolio)
		v1.PUT("/portfolios/:id", handlers.UpdatePortfolio)
		v1.DELETE("/portfolios/:id", handlers.DeletePortfolio)

		// Assets
		v1.GET("/assets", handlers.ListAssets)
		v1.POST("/assets", handlers.CreateAsset)
		v1.GET("/assets/:id", handlers.GetAsset)
		v1.PUT("/assets/:id", handlers.UpdateAsset)
		v1.DELETE("/assets/:id", handlers.DeleteAsset)

		// App Groupings
		v1.GET("/app-groupings", handlers.ListAppGroupings)
		v1.POST("/app-groupings", handlers.CreateAppGrouping)
		v1.GET("/app-groupings/:id", handlers.GetAppGrouping)
		v1.PUT("/app-groupings/:id", handlers.UpdateAppGrouping)
		v1.DELETE("/app-groupings/:id", handlers.DeleteAppGrouping)

		// Applications
		v1.GET("/applications", handlers.ListApplications)
		v1.POST("/applications", handlers.CreateApplication)
		v1.GET("/applications/:id", handlers.GetApplication)
		v1.PUT("/applications/:id", handlers.UpdateApplication)
		v1.DELETE("/applications/:id", handlers.DeleteApplication)

		// Components
		v1.GET("/components", handlers.ListComponents)
		v1.POST("/components", handlers.CreateComponent)
		v1.GET("/components/:id", handlers.GetComponent)
		v1.PUT("/components/:id", handlers.UpdateComponent)
		v1.DELETE("/components/:id", handlers.DeleteComponent)

		// Component Classes (read-only)
		v1.GET("/component-classes", handlers.ListComponentClasses)
		v1.GET("/component-classes/:id", handlers.GetComponentClass)

		// Component Types (read-only, filterable by ?class_id=)
		v1.GET("/component-types", handlers.ListComponentTypes)
		v1.GET("/component-types/:id", handlers.GetComponentType)

		// Component-Workload Junction
		v1.GET("/components/:id/workloads", handlers.ListComponentWorkloads)
		v1.POST("/components/:id/workloads", handlers.LinkWorkload)
		v1.DELETE("/components/:id/workloads/:workload_id", handlers.UnlinkWorkload)

		// Workloads
		v1.GET("/workloads", handlers.ListWorkloads)
		v1.GET("/workloads/lookup", handlers.LookupWorkload)
		v1.POST("/workloads", handlers.CreateWorkload)
		v1.POST("/workloads/bulk", handlers.BulkUpsertWorkloads)
		v1.GET("/workloads/:id", handlers.GetWorkload)
		v1.PUT("/workloads/:id", handlers.UpdateWorkload)
		v1.DELETE("/workloads/:id", handlers.DeleteWorkload)
	}

	return r
}
