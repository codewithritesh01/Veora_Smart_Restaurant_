import React from 'react'
import './Testimonial.css'
import { Star } from 'lucide-react'

const Testimonial = () => {
  const reviews = [
    { name: "Eleanor Williams", text: "Absolutely the best dining experience in town. Every dish was beautifully presented and full of flavor." },
    { name: "Marcus Robertson", text: "The ambiance is elegant and cozy at the same time. Perfect for a romantic dinner." },
    { name: "Emily Watson", text: "From the appetizers to dessert, everything exceeded our expectations." },
    { name: "Thomas Webb", text: "Fresh ingredients, creative presentation, and unforgettable taste." }
  ];

  return (
    <div className='testimonial'>
      <div className="container">
        
        <div className="test-header">
           <h2>What People Are Saying...</h2>
        </div>

        <div className="test-grid">
            {reviews.map((rev, index) => (
                <div className="test-card" key={index}>
                    <div className="stars">
                      <Star size={14} fill="#F96332" color="#F96332" />
                      <Star size={14} fill="#F96332" color="#F96332" />
                      <Star size={14} fill="#F96332" color="#F96332" />
                      <Star size={14} fill="#F96332" color="#F96332" />
                      <Star size={14} fill="#F96332" color="#F96332" />
                    </div>
                    <p className='test-text'>"{rev.text}"</p>
                    <p className='test-author'>- {rev.name}</p>
                </div>
            ))}
        </div>

      </div>
    </div>
  )
}

export default Testimonial
