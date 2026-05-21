import React from 'react'
import Navbar from '../../components/Navbar/Navbar'
import Hero from '../../components/Hero/Hero'
import PopularMenu from '../../components/PopularMenu/PopularMenu'
import Testimonial from '../../components/Testimonial/Testimonial'
import Footer from '../../components/Footer/Footer'

const Landing = () => {
  return (
    <div className='home'>
      <Navbar />
      <Hero />
      <PopularMenu />
      <Testimonial />
      <Footer />
    </div>
  )
}

export default Landing
