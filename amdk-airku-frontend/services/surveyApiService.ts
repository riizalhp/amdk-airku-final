
import api from './api';
import { SurveyResponse } from '../types';

export const getSurveys = async (): Promise<SurveyResponse[]> => {
    const response = await api.get('/surveys');
    return response.data;
};

export const createSurvey = async (surveyData: Omit<SurveyResponse, 'id' | 'salesPersonId'>): Promise<SurveyResponse> => {
    const response = await api.post('/surveys', surveyData);
    return response.data;
};
