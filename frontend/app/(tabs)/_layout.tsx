import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';

export default function Layout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.header,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.tabBarBorder,
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.text,
        },
        headerTintColor: colors.icon,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.tabBarBorder,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.iconMuted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'POS Scanner',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'barcode' : 'barcode-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <MaterialIcons name="inventory-2" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-product"
        options={{
          title: 'Add Product',
          tabBarIcon: ({ color }) => <MaterialIcons name="add-circle-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
