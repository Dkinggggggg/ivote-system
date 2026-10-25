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





  async function login(username, password, role) {


    setLoading(true);


    try {


      const response = await apiClient.post('/login', { username, password, role });

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







  async function logout() {


    try {


      await apiClient.post('/logout');


    } catch (error) {


      console.log(
        'Logout request failed:',
        error
      );


    } finally {



      localStorage.removeItem(
        'ivote_token'
      );


      localStorage.removeItem(
        'ivote_user'
      );


      setUser(null);



    }


  }






  const isAdmin =
    user?.role === 'admin';





  return (


    <AuthContext.Provider

      value={{

        user,

        login,

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