import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Employee {
  id: string;
  name: string;
  position: string;
  created_at: string;
}

interface WorkSession {
  employee_id: string;
  employee_name: string;
  hours_worked: number;
}

interface TipCalculation {
  id: string;
  date: string;
  total_tips: number;
  currency: string;
  work_sessions: WorkSession[];
  total_hours: number;
  tip_per_hour: number;
  individual_tips: { [key: string]: number };
}

export default function Index() {
  const [currentScreen, setCurrentScreen] = useState<'calculator' | 'employees' | 'history'>('calculator');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculations, setCalculations] = useState<TipCalculation[]>([]);

  // Calculator state
  const [totalTips, setTotalTips] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<{ [key: string]: string }>({});
  const [calculationResult, setCalculationResult] = useState<TipCalculation | null>(null);

  // Employee management state
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeePosition, setNewEmployeePosition] = useState('');

  useEffect(() => {
    loadEmployees();
    loadCalculations();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/employees`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const loadCalculations = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tip-calculations?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setCalculations(data);
      }
    } catch (error) {
      console.error('Error loading calculations:', error);
    }
  };

  const addEmployee = async () => {
    if (!newEmployeeName.trim()) {
      Alert.alert('Error', 'Please enter employee name');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newEmployeeName.trim(),
          position: newEmployeePosition.trim() || 'Staff',
        }),
      });

      if (response.ok) {
        setNewEmployeeName('');
        setNewEmployeePosition('');
        await loadEmployees();
        Alert.alert('Success', 'Employee added successfully');
      } else {
        Alert.alert('Error', 'Failed to add employee');
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      Alert.alert('Error', 'Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async (employeeId: string) => {
    Alert.alert(
      'Delete Employee',
      'Are you sure you want to delete this employee?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/employees/${employeeId}`, {
                method: 'DELETE',
              });
              
              if (response.ok) {
                await loadEmployees();
                Alert.alert('Success', 'Employee deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete employee');
              }
            } catch (error) {
              console.error('Error deleting employee:', error);
              Alert.alert('Error', 'Failed to delete employee');
            }
          },
        },
      ]
    );
  };

  const calculateTips = async () => {
    if (!totalTips || parseFloat(totalTips) <= 0) {
      Alert.alert('Error', 'Please enter a valid tip amount');
      return;
    }

    const workSessions: WorkSession[] = [];
    let hasValidHours = false;

    for (const [employeeId, hours] of Object.entries(selectedEmployees)) {
      const hoursNum = parseFloat(hours);
      if (hoursNum > 0) {
        hasValidHours = true;
        const employee = employees.find(e => e.id === employeeId);
        if (employee) {
          workSessions.push({
            employee_id: employeeId,
            employee_name: employee.name,
            hours_worked: hoursNum,
          });
        }
      }
    }

    if (!hasValidHours) {
      Alert.alert('Error', 'Please enter hours for at least one employee');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tip-calculations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          total_tips: parseFloat(totalTips),
          currency: 'RON',
          work_sessions: workSessions,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        setCalculationResult(result);
        await loadCalculations();
      } else {
        Alert.alert('Error', 'Failed to calculate tips');
      }
    } catch (error) {
      console.error('Error calculating tips:', error);
      Alert.alert('Error', 'Failed to calculate tips');
    } finally {
      setLoading(false);
    }
  };

  const resetCalculation = () => {
    setTotalTips('');
    setSelectedEmployees({});
    setCalculationResult(null);
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'calculator' && styles.activeTab]}
        onPress={() => setCurrentScreen('calculator')}
      >
        <Ionicons name="calculator" size={20} color={currentScreen === 'calculator' ? '#fff' : '#666'} />
        <Text style={[styles.tabText, currentScreen === 'calculator' && styles.activeTabText]}>
          Calculator
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'employees' && styles.activeTab]}
        onPress={() => setCurrentScreen('employees')}
      >
        <Ionicons name="people" size={20} color={currentScreen === 'employees' ? '#fff' : '#666'} />
        <Text style={[styles.tabText, currentScreen === 'employees' && styles.activeTabText]}>
          Staff
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'history' && styles.activeTab]}
        onPress={() => setCurrentScreen('history')}
      >
        <Ionicons name="time" size={20} color={currentScreen === 'history' ? '#fff' : '#666'} />
        <Text style={[styles.tabText, currentScreen === 'history' && styles.activeTabText]}>
          History
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCalculator = () => (
    <ScrollView style={styles.screen}>
      <View style={styles.header}>
        <Ionicons name="restaurant" size={32} color="#e74c3c" />
        <Text style={styles.headerTitle}>Dristor Kebab Tips</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Total Tips Today</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.tipInput}
            value={totalTips}
            onChangeText={setTotalTips}
            placeholder="0.00"
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
          <Text style={styles.currency}>RON</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Who Worked Today?</Text>
        {employees.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-add" size={48} color="#999" />
            <Text style={styles.emptyText}>No employees added yet</Text>
            <Text style={styles.emptySubtext}>Go to Staff tab to add employees</Text>
          </View>
        ) : (
          employees.map((employee) => (
            <View key={employee.id} style={styles.employeeRow}>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                <Text style={styles.employeePosition}>{employee.position}</Text>
              </View>
              <View style={styles.hoursContainer}>
                <TextInput
                  style={styles.hoursInput}
                  value={selectedEmployees[employee.id] || ''}
                  onChangeText={(text) => 
                    setSelectedEmployees(prev => ({ ...prev, [employee.id]: text }))
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <Text style={styles.hoursLabel}>hours</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {employees.length > 0 && (
        <TouchableOpacity
          style={styles.calculateButton}
          onPress={calculateTips}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="calculator" size={20} color="#fff" />
              <Text style={styles.calculateButtonText}>Calculate Tips</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {calculationResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Ionicons name="checkmark-circle" size={24} color="#27ae60" />
            <Text style={styles.resultTitle}>Tips Calculated!</Text>
          </View>
          
          <View style={styles.resultSummary}>
            <Text style={styles.resultSummaryText}>
              Total: {calculationResult.total_tips} {calculationResult.currency}
            </Text>
            <Text style={styles.resultSummaryText}>
              Total Hours: {calculationResult.total_hours}h
            </Text>
            <Text style={styles.resultSummaryText}>
              Per Hour: {calculationResult.tip_per_hour} {calculationResult.currency}/h
            </Text>
          </View>

          {calculationResult.work_sessions.map((session) => (
            <View key={session.employee_id} style={styles.resultRow}>
              <View style={styles.resultEmployee}>
                <Text style={styles.resultEmployeeName}>{session.employee_name}</Text>
                <Text style={styles.resultEmployeeHours}>{session.hours_worked}h worked</Text>
              </View>
              <Text style={styles.resultTip}>
                {calculationResult.individual_tips[session.employee_id]} {calculationResult.currency}
              </Text>
            </View>
          ))}

          <TouchableOpacity style={styles.newCalculationButton} onPress={resetCalculation}>
            <Text style={styles.newCalculationButtonText}>New Calculation</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderEmployees = () => (
    <ScrollView style={styles.screen}>
      <View style={styles.header}>
        <Ionicons name="people" size={32} color="#3498db" />
        <Text style={styles.headerTitle}>Staff Management</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add New Employee</Text>
        <TextInput
          style={styles.input}
          value={newEmployeeName}
          onChangeText={setNewEmployeeName}
          placeholder="Employee Name"
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          value={newEmployeePosition}
          onChangeText={setNewEmployeePosition}
          placeholder="Position (optional)"
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={addEmployee}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Employee</Text>
            </>
          )}

        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Staff ({employees.length})</Text>
        {employees.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-add" size={48} color="#999" />
            <Text style={styles.emptyText}>No employees yet</Text>
            <Text style={styles.emptySubtext}>Add your first employee above</Text>
          </View>
        ) : (
          employees.map((employee) => (
            <View key={employee.id} style={styles.employeeCard}>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                <Text style={styles.employeePosition}>{employee.position}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteEmployee(employee.id)}
              >
                <Ionicons name="trash" size={20} color="#e74c3c" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView style={styles.screen}>
      <View style={styles.header}>
        <Ionicons name="time" size={32} color="#9b59b6" />
        <Text style={styles.headerTitle}>Calculation History</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Calculations</Text>
        {calculations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calculator" size={48} color="#999" />
            <Text style={styles.emptyText}>No calculations yet</Text>
            <Text style={styles.emptySubtext}>Start calculating tips to see history</Text>
          </View>
        ) : (
          calculations.map((calc) => (
            <View key={calc.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>
                  {new Date(calc.date).toLocaleDateString()}
                </Text>
                <Text style={styles.historyTotal}>
                  {calc.total_tips} {calc.currency}
                </Text>
              </View>
              <Text style={styles.historyDetails}>
                {calc.work_sessions.length} employees • {calc.total_hours}h total
              </Text>
              <View style={styles.historyEmployees}>
                {calc.work_sessions.map((session, index) => (
                  <Text key={index} style={styles.historyEmployee}>
                    {session.employee_name}: {calc.individual_tips[session.employee_id]} {calc.currency}
                  </Text>
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'calculator':
        return renderCalculator();
      case 'employees':
        return renderEmployees();
      case 'history':
        return renderHistory();
      default:
        return renderCalculator();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderCurrentScreen()}
      {renderTabBar()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  screen: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: Platform.OS === 'ios' ? 0 : 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  tipInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    paddingVertical: 16,
  },
  currency: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  employeePosition: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hoursInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    minWidth: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  hoursLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  calculateButton: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
    marginLeft: 8,
  },
  resultSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  resultSummaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  resultEmployee: {
    flex: 1,
  },
  resultEmployeeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  resultEmployeeHours: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  resultTip: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  newCalculationButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  newCalculationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  addButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  deleteButton: {
    padding: 8,
  },
  historyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  historyTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  historyDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  historyEmployees: {
    marginTop: 4,
  },
  historyEmployee: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
});

