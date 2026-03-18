import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PropertyDashboard } from '@/components/properties/PropertyDashboard';

export default function PropertiesPage() {
  return (
    <MainLayout>
      <PropertyDashboard />
    </MainLayout>
  );
}
