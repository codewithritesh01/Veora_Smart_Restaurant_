import React from 'react'
import './Navbar.css'
import { Link } from 'react-router-dom'

const Navbar = () => {
  return (
    <div className='navbar'>
      <div className='navbar-content container'>
        <Link to='/' className='logo'>Ve<span>ora</span></Link>

        <div className="navbar-right">
          <div className='navbar-auth'>
            <Link to='/login' className='login-btn'>Log In</Link>
            <Link to='/signup' className='veora-btn signup-btn'>Sign Up</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Navbar
