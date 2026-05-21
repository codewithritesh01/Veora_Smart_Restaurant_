import React, { useState } from 'react'
import './Reservation.css'
import { Check, ArrowRight } from 'lucide-react'

const Reservation = () => {
  const [data, setData] = useState({
    name: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    guests: "2",
    message: "",
    coupon_code: ""
  })

  const onChangeHandler = (e) => {
    setData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const onSubmit = (e) => {
    e.preventDefault()
    alert("This is a demo. Booking functionality is not active on this landing page.")
  }

  return (
    <div className='reservation' id='reservations'>
      <div className="container">
        
        <div className="res-content">
          <div className="res-left">
             <div className="pm-badge">Why With Us?</div>
             <h2>Reserve A Table <ArrowRight size={20} className='inline-icon'/></h2>
             
             <div className="features-grid">
               <div className="feature-item">
                 <div className="feature-icon bg-orange"><Check size={16} /></div>
                 <div className="feature-text">
                   <h5>Fresh Ingredients</h5>
                   <p>We source locally grown and organic products.</p>
                 </div>
               </div>
               <div className="feature-item">
                 <div className="feature-icon bg-orange"><Check size={16} /></div>
                 <div className="feature-text">
                   <h5>Premium Atmosphere</h5>
                   <p>Elegant decor that creates a welcoming vibe.</p>
                 </div>
               </div>
               <div className="feature-item">
                 <div className="feature-icon bg-orange"><Check size={16} /></div>
                 <div className="feature-text">
                   <h5>Master Chefs</h5>
                   <p>Our culinary experts bring global flavors to your plate.</p>
                 </div>
               </div>
               <div className="feature-item">
                 <div className="feature-icon bg-orange"><Check size={16} /></div>
                 <div className="feature-text">
                   <h5>Fast & Friendly Service</h5>
                   <p>Exceptional service from start to finish.</p>
                 </div>
               </div>
             </div>
          </div>

          <div className="res-right">
             <div className="res-form-wrapper">
               <h3 id='booking-form'>Book Your Table Today</h3>
               <p className='form-subtitle'>Reserve your spot and enjoy a fine dining experience with us.</p>
               
               <form className="res-form" onSubmit={onSubmit}>
                 <p className="form-legend">Form Fields:</p>
                 <div className="form-group full">
                    <input type="text" name="name" value={data.name} onChange={onChangeHandler} placeholder='Name' required />
                 </div>
                 <div className="form-row">
                    <input type="tel" name="phone" value={data.phone} onChange={onChangeHandler} placeholder='Phone Number' required />
                    <input type="email" name="email" value={data.email} onChange={onChangeHandler} placeholder='Email' required />
                 </div>
                 <div className="form-row">
                    <input type="date" name="date" value={data.date} onChange={onChangeHandler} required />
                    <input type="time" name="time" value={data.time} onChange={onChangeHandler} required />
                 </div>
                 <div className="form-group full">
                    <select name="guests" value={data.guests} onChange={onChangeHandler} required>
                      <option value="" disabled>Number Of Guests</option>
                      <option value="1">1 Person</option>
                      <option value="2">2 People</option>
                      <option value="3">3 People</option>
                      <option value="4">4+ People</option>
                    </select>
                 </div>
                 <div className="form-group full">
                    <input type="text" name="coupon_code" value={data.coupon_code} onChange={onChangeHandler} placeholder='Coupon Code (Optional)' style={{marginBottom: '1rem', width: '100%', padding: '0.8rem', borderRadius: '5px', border: '1px solid #ddd'}} />
                 </div>
                 <div className="form-group full">
                    <textarea name="message" value={data.message} onChange={onChangeHandler} placeholder='Notes (Optional)' rows="3"></textarea>
                 </div>

                 <div className="form-checkbox">
                    <input type="checkbox" id="confirm-call" />
                    <label htmlFor="confirm-call">We'll confirm your reservation via phone or email.</label>
                 </div>

                 <button type="submit" className='veora-btn full-btn'>
                    Reserve Now <ArrowRight size={16} />
                 </button>
               </form>
             </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Reservation
