import React from 'react'
import './Footer.css'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const Footer = () => {
  return (
    <div className='footer' id='contact'>
      <div className="container">
        
        {/* Contact Info Box */}
        <div className="contact-box">
             <div className="contact-box-header">
                <h2>Contact Us</h2>
             </div>
             <div className="contact-grid">
               <div className="contact-item">
                 <h6>Address:</h6>
                 <p>Veora Fine Dining HQ</p>
               </div>
               <div className="contact-item">
                 <h6>Phone:</h6>
                 <p>+1 234 567 890</p>
                 <br />
                 <h6>Email:</h6>
                 <p>hello@veora.com</p>
               </div>
               <div className="contact-item">
                 <h6>Opening Hours:</h6>
                 <p>Mon-Fri: 10am - 10pm</p>
                 <p>Sat-Sun: 12pm - 11pm</p>
               </div>
             </div>
        </div>

        {/* Reserve Banner Map */}
        <div className="reserve-banner">
             <img src="https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&fit=crop" alt="" className='banner-img-left' />
             <div className="banner-content">
               <h2>Reserve Your Table Today</h2>
               <p>Experience fine dining crafted with passion, flavor, and elegance.</p>
               <Link to="/login">
                <button className='veora-btn'>
                  Reserve Today <ArrowUpRight size={14} />
                </button>
               </Link>
             </div>
             <img src="https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&fit=crop" alt="" className='banner-img-right' />
        </div>

        <div className="footer-bottom">
           <div className="footer-logo">
             <h1 style={{ color: 'var(--veora-dark)' }}>Ve<span className='text-orange'>ora</span></h1>
           </div>
           
           <div className="footer-copyright">
             <p>© 2026 Veora Fine Dining. All rights reserved.</p>
           </div>
           
           <div className="footer-slogan">
             <p>Elevating dining with<br />passion and flavor.</p>
           </div>
        </div>

      </div>
    </div>
  )
}

export default Footer
