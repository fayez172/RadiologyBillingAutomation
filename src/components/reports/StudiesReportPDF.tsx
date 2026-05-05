import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableCellHeader: {
    padding: 5,
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 5,
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTop: 0.5,
    paddingTop: 10,
  }
});

interface Props {
  studies: any[];
  entityType: 'radiologist' | 'hospital';
  name: string;
  startDate: string;
  endDate: string;
}

export const StudiesReportPDF = ({ studies, entityType, name, startDate, endDate }: Props) => {
  const isRad = entityType === 'radiologist';
  
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{isRad ? 'Radiologist Billing Details' : 'Hospital Billing Details'}</Text>
          <Text style={styles.subtitle}>{name} • Period: {format(new Date(startDate), 'dd MMM yyyy')} - {format(new Date(endDate), 'dd MMM yyyy')}</Text>
          <Text style={styles.subtitle}>Generated on: {format(new Date(), 'dd MMM yyyy HH:mm')}</Text>
        </View>

        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            <View style={[styles.tableCellHeader, { width: '12%' }]}><Text>Date (BDT)</Text></View>
            <View style={[styles.tableCellHeader, { width: '12%' }]}><Text>MRN</Text></View>
            <View style={[styles.tableCellHeader, { width: '18%' }]}><Text>Patient Name</Text></View>
            <View style={[styles.tableCellHeader, { width: '8%' }]}><Text>Modality</Text></View>
            <View style={[styles.tableCellHeader, { width: '25%' }]}><Text>Procedure Name</Text></View>
            {isRad ? (
              <View style={[styles.tableCellHeader, { width: '25%' }]}><Text>Hospital</Text></View>
            ) : (
              <View style={[styles.tableCellHeader, { width: '25%' }]}><Text>Billing Type</Text></View>
            )}
          </View>

          {/* Data Rows */}
          {studies.map((s, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <View style={[styles.tableCell, { width: '12%' }]}><Text>{s.report_dt ? format(new Date(s.report_dt), 'dd-MM-yy HH:mm') : '-'}</Text></View>
              <View style={[styles.tableCell, { width: '12%' }]}><Text>{s.mrn || 'N/A'}</Text></View>
              <View style={[styles.tableCell, { width: '18%' }]}><Text>{s.patient_name || 'Unknown'}</Text></View>
              <View style={[styles.tableCell, { width: '8%' }]}><Text>{s.modality}</Text></View>
              <View style={[styles.tableCell, { width: '25%' }]}><Text>{s.procedure_raw}</Text></View>
              {isRad ? (
                <View style={[styles.tableCell, { width: '25%' }]}><Text>{s.hospital_name}</Text></View>
              ) : (
                <View style={[styles.tableCell, { width: '25%' }]}><Text>{s.type}</Text></View>
              )}
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          TeleRadiology Billing System - Page total: {studies.length} studies
        </Text>
      </Page>
    </Document>
  );
};
