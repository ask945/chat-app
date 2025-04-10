import React,{useState} from 'react';
import './Login.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const LoginForm=()=>{
    const navigate=useNavigate();
    const[loginData,setLoginData]=useState({
        email:'',
        password:''
    });

    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setLoginData({
      ...loginData,
      [name]: value
        });
        if (errors[name]) {
            setErrors({
                ...errors,
                [name]: ''
            });
        }
    };

    const validate = () => {
        let tempErrors = {};
        let isValid = true;
    
        if (!loginData.email.trim()) {
          tempErrors.email = 'Email is required';
          isValid = false;
        }
    
        if (!loginData.password) {
          tempErrors.password = 'Password is required';
          isValid = false;
        }
    
        setErrors(tempErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (validate()) {
          setIsLoading(true);
          try {
            const response = await axios.post('http://localhost:8001/login', {
              email: loginData.email,
              password: loginData.password
            });
            
            if (response.data.token) {
              localStorage.setItem('chatToken', response.data.token);
              navigate('/chat');
            }
            } catch (error) {
                if (error.response && error.response.data) {
                    alert(error.response.data.message || 'Login failed!');
                } else {
                    alert('Something went wrong. Please try again.');
                }
            } finally {
                setIsLoading(false);
            }
        }
    };
    return (
        <div className="login-container">
          <h2>Login to Your Account</h2>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={loginData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={loginData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>
            
            <button type="submit" disabled={isLoading} className="login-button">
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            
            <div className="register-link">
              Don't have an account? <a href="/register">Register here</a>
            </div>
          </form>
        </div>
      );
    };
    
    export default LoginForm;