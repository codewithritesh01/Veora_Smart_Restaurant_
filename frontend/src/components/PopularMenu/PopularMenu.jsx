import React, { useState, useEffect } from 'react'
import './PopularMenu.css'
import { ArrowUpRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import api, { BASE_URL } from '../../api/client'

const PopularMenu = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Map categories to high-quality images
  const categoryImages = {
    "Main Dishes": `${BASE_URL}/media/categories/main_dishes.png`,
    "Indian Dishes": `${BASE_URL}/media/categories/indian_dishes.png`,
    "Fast Food & Snacks": `${BASE_URL}/media/categories/fast_food.png`,
    "Indo-Chinese / Continental": `${BASE_URL}/media/categories/indo_chinese.png`,
    "Beverages": `${BASE_URL}/media/categories/beverages.png`,
    "Default": `${BASE_URL}/media/categories/main_dishes.png`
  }

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/api/user/menu')
        const items = response.data
        // Extract unique categories (excluding "All")
        const uniqueCategories = [...new Set(items.map(item => item.category))]
        setCategories(uniqueCategories)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching categories:", error)
        setLoading(false)
      }
    }
    fetchCategories()
  }, [])

  return (
    <div className='popular-menu' id='popular-menu'>
      <div className="container">
        
        <div className="pm-header">
           <div className="pm-badge">Taste Our Story</div>
           <h2>Explore by Category</h2>
           <p className="pm-subtitle">Discover our diverse culinary collections curated for every palate.</p>
        </div>

        <div className="pm-cards categories-grid">
            {loading ? (
              <p>Preparing the menu adventure...</p>
            ) : (
              categories.map((cat, index) => (
                  <Link 
                    to={`/menu?category=${encodeURIComponent(cat)}`} 
                    key={index}
                    className="pm-card category-card"
                  >
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        whileHover={{ scale: 1.05 }}
                    >
                        <div className="pm-card-img-wrapper large-category">
                            <img 
                              src={categoryImages[cat] || categoryImages["Default"]} 
                              alt={cat} 
                            />
                            <div className="pm-card-overlay visible">
                                <div className="category-title-box">
                                  <h3>{cat}</h3>
                                  <div className="explore-hint">
                                    Explore Menu <ArrowUpRight size={14} />
                                  </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                  </Link>
              ))
            )}
        </div>

        <div className="pm-footer">
            <Link to='/menu'>
              <button className='veora-btn'>
                View Full Menu
                <div className="arrow-box">
                  <ArrowUpRight size={14} strokeWidth={3} />
                </div>
              </button>
            </Link>
        </div>

      </div>
    </div>
  )
}

export default PopularMenu
