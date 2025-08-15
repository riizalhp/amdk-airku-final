
import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { AppContextType, User } from '../types';
import api, { setAuthToken } from '../services/api';

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const loadUser = () => {
            try {
                const storedToken = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');
                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setCurrentUser(JSON.parse(storedUser));
                    setAuthToken(storedToken); 
                }
            } catch (error) {
                console.error("Failed to load user from localStorage", error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } finally {
                setIsLoading(false);
            }
        };
        loadUser();
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        const { token, user } = response.data;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        setToken(token);
        setCurrentUser(user);
        setAuthToken(token);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setCurrentUser(null);
        setAuthToken(null);
    }, []);

    const value: AppContextType = { 
        currentUser,
        token,
        isLoading,
        login, 
        logout,
    };

    return (
        <AppContext.Provider value={value}>
            {!isLoading && children}
        </AppContext.Provider>
    );
};
