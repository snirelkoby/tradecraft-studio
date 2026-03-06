import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const Index = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to="/" replace />;
};

export default Index;
