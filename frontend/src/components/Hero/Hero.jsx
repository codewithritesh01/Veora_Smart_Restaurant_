import React from 'react'
import './Hero.css'
import { motion } from 'framer-motion'
import { ArrowUpRight, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

const Hero = () => {
  return (
    <div className='hero'>
      <div className="hero-content container">
        <motion.div
          className="hero-left"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1>Experience <span className='text-orange'>Fine</span><br />
            <span className='text-orange'>Dining</span> Like <span className='text-muted'>Never</span><br />
            <span className='text-muted'>Before</span></h1>

          <div className="hero-left-desc">
            <p>Fresh ingredients, unforgettable taste, premium ambiance.</p>
            <Link to='/login'>
              <button className='veora-btn mt-3'>
                Reserve A Table
                <div className="arrow-box">
                  <ArrowUpRight size={14} strokeWidth={3} />
                </div>
              </button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="hero-right"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="hero-image-wrapper">
            <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&fit=crop&q=80" alt="Fine Dining Salad" className='hero-main-img' />

            {/* Floating Badges */}
            <motion.div
              className="badge badge-guests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <div className="guest-avatars">
                <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="" />
                <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="" />
                <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="" />
              </div>
              <p><strong>10,000+</strong> Happy Guests</p>
            </motion.div>

            <motion.div
              className="badge badge-rating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              <p><strong>3,000+</strong> 4.9 Rating</p>
              <Star size={14} fill="#F96332" color="#F96332" />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Wavy transition layer */}
      <div className="hero-wavylayer">
        <svg viewBox="0 0 1440 120" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,96L80,85.3C160,75,320,53,480,53.3C640,53,800,75,960,80C1120,85,1280,75,1360,69.3L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z" fill="#092B21"></path>
        </svg>
      </div>
    </div>
  )
}

export default Hero
