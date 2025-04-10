import React ,{useState} from 'react';
import axios from 'axios';
import './Register.css';
import {useNavigate} from 'react-router-dom';

const RegisterForm=()=>{
    const navigate=useNavigate();
    const[registerData,setRegisterData]=useState({
        name:'',
        email:'',
        mobileno:'',
        password:'',
        confirmpassword:''
    });

    const[errors,setErrors]=useState({});
    const[isLoading,setIsLoading]=useState(false);

    const handleChange=(event)=>{
        const{name,value}=event.target;
        setRegisterData({
            ...registerData,[name]:value
        });

        if(errors){
            setErrors({
                ...errors,
                [name]:''
            })
        }
    };

    const validate=()=>{
        let tempErrors={};
        let isValid=true;

        if (!registerData.name.trim()) {
            tempErrors.name = 'Name is required';
            isValid = false;
        }
        if (!registerData.email.trim()) {
            tempErrors.email = 'Email is required';
            isValid = false;
          } else if (!/\S+@\S+\.\S+/.test(registerData.email)) {
            tempErrors.email = 'Email is invalid';
            isValid = false;
        }
        if (!registerData.mobileno.trim()) {
            tempErrors.mobileno = 'Phone number is required';
            isValid = false;
        } else if (!/^\d{10}$/.test(registerData.mobileno.replace(/[^0-9]/g, ''))) {
            tempErrors.mobileno = 'Phone number is invalid (should be 10 digits)';
            isValid = false;
        }
      
        if (!registerData.password) {
            tempErrors.password = 'Password is required';
            isValid = false;
        } else if (registerData.password.length < 6) {
            tempErrors.password = 'Password should be at least 6 characters';
            isValid = false;
        }
      
        if (registerData.password !== registerData.confirmPassword) {
            tempErrors.confirmPassword = 'Passwords do not match';
            isValid = false;
        }
        setErrors(tempErrors);
        return isValid;
    }

    const handleSubmit=async(event)=>{
        event.preventDefault();

        if(validate()){
            setIsLoading(true);
            try{
                const response= await axios.post('http://localhost:8001/register',{
                    name:registerData.name,
                    email:registerData.email,
                    mobileno:registerData.mobileno,
                    password:registerData.password
                });
                if (response.data.success) {
                    alert('Registration successful! Please login.');
                    navigate('/login');
                }
            }catch(error){
            console.log('Error occurred',error);
                if (error.response && error.response.data) {
                    alert(error.response.data.message || 'Registration failed!');
                    if (error.response.data.field) {
                    setErrors({
                        ...errors,
                        [error.response.data.field]: error.response.data.message
                    });
                    }
                } else {
                    alert('Something went wrong. Please try again.');
                }
            }
            finally {
                setIsLoading(false);
            }
        }
    };


    return (
        <div className="register-container">
          <h2>Create an Account</h2>
          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={registerData.name}
                onChange={handleChange}
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>
            
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={registerData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
            
            <div className="form-group">
              <label>Mobile No</label>
              <input
                type="tel"
                name="mobileno"
                value={registerData.mobileno}
                onChange={handleChange}
                className={errors.mobileno ? 'error' : ''}
              />
              {errors.mobileno && <span className="error-message">{errors.mobileno}</span>}
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={registerData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>
            
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={registerData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error' : ''}
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
            </div>
            
            <button type="submit" disabled={isLoading} className="register-button">
              {isLoading ? 'Registering...' : 'Register'}
            </button>
            
            <div className="login-link">
              Already have an account? <a href="/login">Login here</a>
            </div>
          </form>
        </div>
      );
    };
    
    export default RegisterForm;