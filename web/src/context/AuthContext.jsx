import React, {
  createContext,
  useContext,
  useState
} from 'react';

import apiClient from '../api/apiClient';


const AuthContext = createContext(null);



export function AuthProvider({ children }) {


  const [loading, setLoading] = useState(false);



  const [user, setUser] = useState(() => {


    const storedUser = localStorage.getItem('ivote_user');


    if (
      !storedUser ||
      storedUser === 'undefined' ||
      storedUser === 'null'
    ) {

      localStorage.removeItem('ivote_user');
      localStorage.removeItem('ivote_token');

      return null;

    }



    try {

      return JSON.parse(storedUser);

    } catch (error) {

      console.error(
        'Invalid saved user:',
        error
      );


      localStorage.removeItem('ivote_user');
      localStorage.removeItem('ivote_token');


      return null;

    }


  });





  async function login(email, password, role) {


    setLoading(true);


    try {


      const response = await apiClient.post('/login', { email, password, role });

      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error('Invalid login response');
      }

      localStorage.setItem('ivote_token', token);
      localStorage.setItem('ivote_user', JSON.stringify(user));

      setUser(user);

      return user;
    } finally {
      setLoading(false);
    }
  }







  async function logout(animationMs = 0) {
    try {
      await apiClient.post('/logout');
    } catch (error) {
      console.log('Logout request failed:', error);
    }

    if (animationMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, animationMs));
    }

    localStorage.removeItem('ivote_token');
    localStorage.removeItem('ivote_user');
    setUser(null);
  }

  async function changePassword(currentPassword, password, passwordConfirmation) {
    const response = await apiClient.post('/change-password', {
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    });
    const updatedUser = response.data.user;

    localStorage.setItem('ivote_user', JSON.stringify(updatedUser));
    setUser(updatedUser);

    return updatedUser;
  }






  const isAdmin =
    user?.role === 'admin';





  return (


    <AuthContext.Provider

      value={{

        user,

        login,

        changePassword,

        logout,

        isAdmin,

        loading

      }}

    >


      {children}


    </AuthContext.Provider>


  );


}






export function useAuth() {


  return useContext(AuthContext);


}