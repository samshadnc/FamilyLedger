import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from './firebase';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import CategoryDetail from './pages/CategoryDetail';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import ExpenseModal from './components/ExpenseModal';
import { LayoutDashboard, List, Plus, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { DEFAULT_TAGS, ACCOUNTS, CATEGORIES, DEFAULT_PRESETS, CLOUDINARY_CLOUD, CLOUDINARY_PRESET } from './constants';
import { getReceiptBlob, deleteReceiptBlob } from './utils/receiptDb';
import { useTheme } from './hooks/useTheme';

// Real October 2026 data imported from Axio (Samshad) + fake Sahla entries
const DEMO_EXPENSES = [
  { id: 'd1',  amount: 30.86, currency: 'SGD', sgdAmount: 30.86, category: 'utilities',    payee: 'Claude',           note: '',                                              date: '2026-10-01', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd2',  amount: 3.50,  currency: 'SGD', sgdAmount: 3.50,  category: 'food',         payee: 'Indian Muslim Food',note: 'masala dosa',                                  date: '2026-10-02', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd3',  amount: 1.28,  currency: 'SGD', sgdAmount: 1.28,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-02', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd4',  amount: 2.70,  currency: 'SGD', sgdAmount: 2.70,  category: 'food',         payee: 'Canteen',          note: 'rice ckn',                                      date: '2026-10-02', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd5',  amount: 1.10,  currency: 'SGD', sgdAmount: 1.10,  category: 'food',         payee: 'Canteen',          note: 'waffles',                                       date: '2026-10-02', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd6',  amount: 22.50, currency: 'SGD', sgdAmount: 22.50, category: 'travel',       payee: 'IRCTC',            note: 'tatkal tir to qld',                             date: '2026-10-02', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_scapia', tags: [] },
  { id: 'd7',  amount: 26.44, currency: 'SGD', sgdAmount: 26.44, category: 'groceries',    payee: 'Sheng Siong',      note: 'ckn, oil, onion, banana, yogurt, chilli, ginger, fry mix', date: '2026-10-03', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs', tags: [] },
  { id: 'd8',  amount: 8.50,  currency: 'SGD', sgdAmount: 8.50,  category: 'food',         payee: 'Canteen',          note: 'dosha and tea',                                 date: '2026-10-04', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: ['Sahla', 'Samshad'] },
  { id: 'd9',  amount: 43.00, currency: 'SGD', sgdAmount: 43.00, category: 'other',        payee: 'Hostinger',        note: 'sahlam.net for 2 years',                        date: '2026-10-04', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_scapia', tags: ['Sahla'] },
  { id: 'd10', amount: 2.56,  currency: 'SGD', sgdAmount: 2.56,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-05', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd11', amount: 15.00, currency: 'SGD', sgdAmount: 15.00, category: 'utilities',    payee: 'Singtel',          note: 'samshad line',                                  date: '2026-10-06', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd12', amount: 1.28,  currency: 'SGD', sgdAmount: 1.28,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-06', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd13', amount: 13.53, currency: 'SGD', sgdAmount: 13.53, category: 'groceries',    payee: 'Sheng Siong',      note: 'squash, shallot, banana, chips',                date: '2026-10-07', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd14', amount: 2.00,  currency: 'SGD', sgdAmount: 2.00,  category: 'entertainment',payee: 'Hello Ride',       note: 'cycle ride x2',                                 date: '2026-10-07', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd15', amount: 4.00,  currency: 'SGD', sgdAmount: 4.00,  category: 'food',         payee: 'Canteen',          note: 'lunch',                                         date: '2026-10-08', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd16', amount: 1.10,  currency: 'SGD', sgdAmount: 1.10,  category: 'food',         payee: 'Aries and Shine',  note: 'waffles',                                       date: '2026-10-08', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd17', amount: 2.56,  currency: 'SGD', sgdAmount: 2.56,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-08', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd18', amount: 9.69,  currency: 'SGD', sgdAmount: 9.69,  category: 'groceries',    payee: 'Sheng Siong',      note: 'egg, sugar, spinach',                           date: '2026-10-09', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd19', amount: 2.56,  currency: 'SGD', sgdAmount: 2.56,  category: 'transport',    payee: 'MRT',              note: 'clementi',                                      date: '2026-10-10', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd20', amount: 3.00,  currency: 'SGD', sgdAmount: 3.00,  category: 'groceries',    payee: 'Clementi Market',  note: 'parsimon, lagan',                               date: '2026-10-10', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd21', amount: 2.50,  currency: 'SGD', sgdAmount: 2.50,  category: 'groceries',    payee: 'Clementi Market',  note: 'banana',                                        date: '2026-10-10', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd22', amount: 10.00, currency: 'SGD', sgdAmount: 10.00, category: 'shopping',     payee: 'Clementi Market',  note: 'dress x 4',                                     date: '2026-10-10', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: ['Sahla'] },
  { id: 'd23', amount: 2.25,  currency: 'SGD', sgdAmount: 2.25,  category: 'groceries',    payee: 'FairPrice',        note: 'detergent 1.2kg',                               date: '2026-10-10', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd24', amount: 3.92,  currency: 'SGD', sgdAmount: 3.92,  category: 'transport',    payee: 'MRT',              note: 'Arab Street',                                   date: '2026-10-11', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd25', amount: 14.00, currency: 'SGD', sgdAmount: 14.00, category: 'shopping',     payee: 'Amazon.in',        note: 'anil bday gift card',                           date: '2026-10-11', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_scapia', tags: ['Sahla'] },
  { id: 'd26', amount: 30.00, currency: 'SGD', sgdAmount: 30.00, category: 'utilities',    payee: 'Claude',           note: 'sahla subscription',                            date: '2026-10-11', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd27', amount: 10.00, currency: 'SGD', sgdAmount: 10.00, category: 'food',         payee: 'Arab Street',      note: 'sahla prof party',                              date: '2026-10-11', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: ['Sahla'] },
  { id: 'd28', amount: 3.50,  currency: 'SGD', sgdAmount: 3.50,  category: 'food',         payee: 'Arab Street',      note: 'sahla prof party',                              date: '2026-10-11', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd29', amount: 2.70,  currency: 'SGD', sgdAmount: 2.70,  category: 'food',         payee: 'Canteen',          note: 'lunch',                                         date: '2026-10-12', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: ['Samshad'] },
  { id: 'd30', amount: 2.56,  currency: 'SGD', sgdAmount: 2.56,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-12', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd31', amount: 5.05,  currency: 'SGD', sgdAmount: 5.05,  category: 'groceries',    payee: 'FairPrice',        note: 'ckn x 2kg',                                     date: '2026-10-12', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd32', amount: 26.00, currency: 'SGD', sgdAmount: 26.00, category: 'shopping',     payee: 'Amazon.in',        note: 'jack baby bday, portable kettle',               date: '2026-10-12', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_scapia', tags: ['Samshad'] },
  { id: 'd33', amount: 1.95,  currency: 'SGD', sgdAmount: 1.95,  category: 'groceries',    payee: 'Lazada',           note: 'oats',                                          date: '2026-10-13', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd34', amount: 12.32, currency: 'SGD', sgdAmount: 12.32, category: 'groceries',    payee: 'Sheng Siong',      note: 'yogurt, chips, banana, bun',                    date: '2026-10-13', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd35', amount: 4.20,  currency: 'SGD', sgdAmount: 4.20,  category: 'groceries',    payee: 'TikTok Shop',      note: 'dates, cake tin, oats',                         date: '2026-10-14', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd36', amount: 2.56,  currency: 'SGD', sgdAmount: 2.56,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-14', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd37', amount: 2.56,  currency: 'SGD', sgdAmount: 2.56,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-15', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd38', amount: 15.00, currency: 'SGD', sgdAmount: 15.00, category: 'utilities',    payee: 'Singtel',          note: 'sahla line, paid via sahla mari',               date: '2026-10-15', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd39', amount: 7.00,  currency: 'SGD', sgdAmount: 7.00,  category: 'food',         payee: 'Canteen',          note: 'lunch',                                         date: '2026-10-16', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: ['Samshad', 'Sahla'] },
  { id: 'd40', amount: 1.28,  currency: 'SGD', sgdAmount: 1.28,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-16', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd41', amount: 1.28,  currency: 'SGD', sgdAmount: 1.28,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-17', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd42', amount: 76.47, currency: 'SGD', sgdAmount: 76.47, category: 'utilities',    payee: 'Utility Bill',     note: '',                                              date: '2026-10-17', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd43', amount: 16.87, currency: 'SGD', sgdAmount: 16.87, category: 'groceries',    payee: 'Sheng Siong',      note: 'basmati rice, snacks, chocolate, curry leaves',  date: '2026-10-18', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd44', amount: 3.84,  currency: 'SGD', sgdAmount: 3.84,  category: 'transport',    payee: 'MRT',              note: 'clementi',                                      date: '2026-10-18', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd45', amount: 3.50,  currency: 'SGD', sgdAmount: 3.50,  category: 'food',         payee: 'Mixue',            note: 'mulberry berry milk',                           date: '2026-10-18', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: ['Samshad'] },
  { id: 'd46', amount: 3.40,  currency: 'SGD', sgdAmount: 3.40,  category: 'groceries',    payee: 'Sheng Siong',      note: 'onion 2.8kg',                                   date: '2026-10-18', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd47', amount: 5.50,  currency: 'SGD', sgdAmount: 5.50,  category: 'groceries',    payee: 'Market',           note: 'banana, orange, parsimon',                      date: '2026-10-18', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd48', amount: 10.00, currency: 'SGD', sgdAmount: 10.00, category: 'utilities',    payee: 'Simba',            note: 'mnp',                                           date: '2026-10-18', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd49', amount: 1.28,  currency: 'SGD', sgdAmount: 1.28,  category: 'transport',    payee: 'NUS',              note: '',                                              date: '2026-10-19', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  { id: 'd50', amount: 7.40,  currency: 'SGD', sgdAmount: 7.40,  category: 'food',         payee: 'Canteen',          note: 'lunch',                                         date: '2026-10-20', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: ['Sahla', 'Samshad'] },
  { id: 'd51', amount: 1300,  currency: 'SGD', sgdAmount: 1300,  category: 'rent',         payee: 'Rent',             note: '',                                              date: '2026-10-20', addedBy: 'u1', addedByName: 'Samshad', account: 'samshad_dbs',    tags: [] },
  // Sahla – October 2026
  { id: 's1',  amount: 62.50, currency: 'SGD', sgdAmount: 62.50, category: 'groceries',    payee: 'FairPrice',        note: 'weekly groceries',                              date: '2026-10-05', addedBy: 'u2', addedByName: 'Sahla',   account: 'sahla_dbs',      tags: ['Shared'] },
  { id: 's2',  amount: 18.90, currency: 'SGD', sgdAmount: 18.90, category: 'food',         payee: 'Canteen',          note: 'lunch x3',                                      date: '2026-10-08', addedBy: 'u2', addedByName: 'Sahla',   account: 'sahla_dbs',      tags: [] },
  { id: 's3',  amount: 3.20,  currency: 'SGD', sgdAmount: 3.20,  category: 'transport',    payee: 'MRT',              note: '',                                              date: '2026-10-09', addedBy: 'u2', addedByName: 'Sahla',   account: 'sahla_dbs',      tags: [] },
  { id: 's4',  amount: 45.00, currency: 'SGD', sgdAmount: 45.00, category: 'shopping',     payee: 'Shopee',           note: 'clothes',                                       date: '2026-10-13', addedBy: 'u2', addedByName: 'Sahla',   account: 'sahla_dbs',      tags: [] },
  { id: 's5',  amount: 12.80, currency: 'SGD', sgdAmount: 12.80, category: 'food',         payee: 'Canteen',          note: 'lunch',                                         date: '2026-10-16', addedBy: 'u2', addedByName: 'Sahla',   account: 'sahla_dbs',      tags: [] },
  { id: 's6',  amount: 38.60, currency: 'SGD', sgdAmount: 38.60, category: 'groceries',    payee: 'Sheng Siong',      note: 'vegetables, fruits',                            date: '2026-10-19', addedBy: 'u2', addedByName: 'Sahla',   account: 'sahla_dbs',      tags: ['Shared'] },
];

// Extended demo data across 6 months (used by CategoryDetail)
const DEMO_HISTORY = [
  // May 2026
  { id:'h1',  amount:110,   currency:'SGD', sgdAmount:110,   category:'food',        payee:'Canteen',          note:'lunch x4',                           date:'2026-05-18', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:['Personal'] },
  { id:'h2',  amount:195,   currency:'SGD', sgdAmount:195,   category:'groceries',   payee:'FairPrice',        note:'weekly groceries',                   date:'2026-05-10', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Shared'] },
  { id:'h3',  amount:1300,  currency:'SGD', sgdAmount:1300,  category:'rent',        payee:'Rent',             note:'',                                   date:'2026-05-01', addedBy:'u1', addedByName:'Samshad', account:'samshad_sbi',    tags:['Shared'] },
  { id:'h4',  amount:38,    currency:'SGD', sgdAmount:38,    category:'transport',   payee:'MRT',              note:'monthly pass',                       date:'2026-05-05', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Personal'] },
  { id:'h5',  amount:24.30, currency:'SGD', sgdAmount:24.30, category:'groceries',   payee:'Sheng Siong',      note:'ckn, vegetables, banana',            date:'2026-05-14', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  { id:'h6',  amount:15.00, currency:'SGD', sgdAmount:15.00, category:'utilities',   payee:'Singtel',          note:'samshad line',                       date:'2026-05-06', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  // June 2026
  { id:'h7',  amount:98,    currency:'SGD', sgdAmount:98,    category:'food',        payee:'Canteen',          note:'lunch + dinner',                     date:'2026-06-22', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Personal'] },
  { id:'h8',  amount:185,   currency:'SGD', sgdAmount:185,   category:'groceries',   payee:'FairPrice',        note:'monthly shop',                       date:'2026-06-14', addedBy:'u2', addedByName:'Sahla',   account:'sahla_sbi',      tags:['Shared'] },
  { id:'h9',  amount:1300,  currency:'SGD', sgdAmount:1300,  category:'rent',        payee:'Rent',             note:'',                                   date:'2026-06-01', addedBy:'u1', addedByName:'Samshad', account:'samshad_sbi',    tags:['Shared'] },
  { id:'h10', amount:52,    currency:'SGD', sgdAmount:52,    category:'transport',   payee:'MRT',              note:'monthly pass',                       date:'2026-06-05', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:['Personal'] },
  { id:'h11', amount:45,    currency:'SGD', sgdAmount:45,    category:'utilities',   payee:'Utility Bill',     note:'SP Services',                        date:'2026-06-08', addedBy:'u2', addedByName:'Sahla',   account:'sahla_sbi',      tags:['Shared'] },
  { id:'h12', amount:18.50, currency:'SGD', sgdAmount:18.50, category:'groceries',   payee:'Sheng Siong',      note:'basmati rice 5kg, sugar, onion',     date:'2026-06-19', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  { id:'h13', amount:15.00, currency:'SGD', sgdAmount:15.00, category:'utilities',   payee:'Singtel',          note:'samshad line',                       date:'2026-06-06', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  // July 2026
  { id:'h14', amount:145,   currency:'SGD', sgdAmount:145,   category:'food',        payee:'Canteen',          note:'lunch x5, waffle x3',                date:'2026-07-19', addedBy:'u1', addedByName:'Samshad', account:'samshad_scapia', tags:['Personal'] },
  { id:'h15', amount:210,   currency:'SGD', sgdAmount:210,   category:'groceries',   payee:'Sheng Siong',      note:'ckn, oil, rice, vegetables',         date:'2026-07-11', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Shared'] },
  { id:'h16', amount:1300,  currency:'SGD', sgdAmount:1300,  category:'rent',        payee:'Rent',             note:'',                                   date:'2026-07-01', addedBy:'u1', addedByName:'Samshad', account:'samshad_sbi',    tags:['Shared'] },
  { id:'h17', amount:48,    currency:'SGD', sgdAmount:48,    category:'utilities',   payee:'Utility Bill',     note:'SP Services',                        date:'2026-07-09', addedBy:'u2', addedByName:'Sahla',   account:'sahla_sbi',      tags:['Shared'] },
  { id:'h18', amount:65,    currency:'SGD', sgdAmount:65,    category:'health',      payee:'Dental Clinic',    note:'dental checkup',                     date:'2026-07-15', addedBy:'u1', addedByName:'Samshad', account:'samshad_scapia', tags:['Medical'] },
  { id:'h19', amount:15.00, currency:'SGD', sgdAmount:15.00, category:'utilities',   payee:'Singtel',          note:'sahla line',                         date:'2026-07-06', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  // August 2026
  { id:'h20', amount:112,   currency:'SGD', sgdAmount:112,   category:'food',        payee:'Canteen',          note:'lunch x4, hawker dinner',            date:'2026-08-20', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:['Personal'] },
  { id:'h21', amount:195,   currency:'SGD', sgdAmount:195,   category:'groceries',   payee:'FairPrice',        note:'monthly groceries',                  date:'2026-08-12', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Shared'] },
  { id:'h22', amount:1300,  currency:'SGD', sgdAmount:1300,  category:'rent',        payee:'Rent',             note:'',                                   date:'2026-08-01', addedBy:'u1', addedByName:'Samshad', account:'samshad_sbi',    tags:['Shared'] },
  { id:'h23', amount:38,    currency:'SGD', sgdAmount:38,    category:'transport',   payee:'MRT',              note:'monthly pass',                       date:'2026-08-05', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Personal'] },
  { id:'h24', amount:85,    currency:'SGD', sgdAmount:85,    category:'shopping',    payee:'UNIQLO',           note:'sale items',                         date:'2026-08-18', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Personal'] },
  { id:'h25', amount:22.80, currency:'SGD', sgdAmount:22.80, category:'groceries',   payee:'Sheng Siong',      note:'rice, banana, egg, yogurt',          date:'2026-08-07', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  { id:'h26', amount:15.00, currency:'SGD', sgdAmount:15.00, category:'utilities',   payee:'Singtel',          note:'samshad line',                       date:'2026-08-06', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  // September 2026
  { id:'h27', amount:135,   currency:'SGD', sgdAmount:135,   category:'food',        payee:'Canteen',          note:'lunch x5, dinner x2',                date:'2026-09-17', addedBy:'u2', addedByName:'Sahla',   account:'sahla_dbs',      tags:['Personal'] },
  { id:'h28', amount:220,   currency:'SGD', sgdAmount:220,   category:'groceries',   payee:'FairPrice',        note:'monthly groceries + NTUC',           date:'2026-09-09', addedBy:'u2', addedByName:'Sahla',   account:'sahla_sbi',      tags:['Shared'] },
  { id:'h29', amount:1300,  currency:'SGD', sgdAmount:1300,  category:'rent',        payee:'Rent',             note:'',                                   date:'2026-09-01', addedBy:'u1', addedByName:'Samshad', account:'samshad_sbi',    tags:['Shared'] },
  { id:'h30', amount:52,    currency:'SGD', sgdAmount:52,    category:'utilities',   payee:'Utility Bill',     note:'SP Services',                        date:'2026-09-08', addedBy:'u2', addedByName:'Sahla',   account:'sahla_sbi',      tags:['Shared'] },
  { id:'h31', amount:41,    currency:'SGD', sgdAmount:41,    category:'transport',   payee:'MRT',              note:'monthly + bus',                      date:'2026-09-05', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:['Personal'] },
  { id:'h32', amount:65,    currency:'SGD', sgdAmount:65,    category:'health',      payee:'Clinic',           note:'GP visit',                           date:'2026-09-21', addedBy:'u1', addedByName:'Samshad', account:'samshad_scapia', tags:['Medical'] },
  { id:'h33', amount:19.40, currency:'SGD', sgdAmount:19.40, category:'groceries',   payee:'Sheng Siong',      note:'basmati rice, oats, banana, snacks', date:'2026-09-14', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
  { id:'h34', amount:15.00, currency:'SGD', sgdAmount:15.00, category:'utilities',   payee:'Singtel',          note:'samshad line',                       date:'2026-09-06', addedBy:'u1', addedByName:'Samshad', account:'samshad_dbs',    tags:[] },
];

// All demo expenses across all months
const DEMO_ALL_EXPENSES = [...DEMO_EXPENSES, ...DEMO_HISTORY];

const DEMO_PROFILES = {
  Samshad: { uid: 'u1', email: 'samshad@test.com',  displayName: 'Samshad' },
  Sahla:   { uid: 'u2', email: 'sahla@test.com',    displayName: 'Sahla'   },
};

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function App() {
  const { user, profile: realProfile } = useAuth();
  const { dark, toggle: toggleDark } = useTheme();
  const [tab,              setTab]             = useState('dashboard');
  const [month,            setMonth]           = useState(currentYM());
  const [expenses,         setExpenses]        = useState([]);
  const [loading,          setLoading]         = useState(true);
  const [showModal,        setShowModal]       = useState(false);
  const [editTarget,       setEditTarget]      = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null); // categoryId or null
  const [dashKey,          setDashKey]          = useState(0);   // increment to reset Dashboard internal state
  const [showSettings,     setShowSettings]    = useState(false);
  const [selectedTag,      setSelectedTag]     = useState(null);  // tag string or null
  const [selectedAccount,  setSelectedAccount] = useState(null);  // account id or null
  const [selectedPayee,    setSelectedPayee]   = useState(null);  // payee string or null
  const [demoUser,         setDemoUser]        = useState('Samshad'); // demo profile switcher

  const handleTagSelect = (tag) => {
    setSelectedTag(tag);
    setSelectedAccount(null);
    setSelectedPayee(null);
    setTab('expenses');
    setSelectedCategory(null);
  };

  const handleAccountSelect = (accId) => {
    setSelectedAccount(accId);
    setSelectedTag(null);
    setSelectedPayee(null);
    setTab('expenses');
    setSelectedCategory(null);
  };

  const handlePayeeSelect = (payee) => {
    setSelectedPayee(payee);
    setSelectedTag(null);
    setSelectedAccount(null);
    setTab('expenses');
    setSelectedCategory(null);
  };

  // Settings: tags, accounts, categories — persisted in localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('fl_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved categories with defaults so new fields (budget) are always present
        const catDefaults = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
        const mergedCats = (parsed.categories ?? CATEGORIES).map(c => ({
          ...catDefaults[c.id],
          ...c,
          budget: c.budget ?? catDefaults[c.id]?.budget ?? 0,
        }));
        return { allowEditOthers: false, presets: DEFAULT_PRESETS, accounts: ACCOUNTS, ...parsed, categories: mergedCats };
      }
    } catch {}
    return { tags: DEFAULT_TAGS, accounts: ACCOUNTS, categories: CATEGORIES, allowEditOthers: false, presets: DEFAULT_PRESETS };
  });

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    try { localStorage.setItem('fl_settings', JSON.stringify(newSettings)); } catch {}
  };

  // Demo mode: no Firebase creds
  const isDemo = !import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID === 'dummy-project';
  const profile = isDemo ? DEMO_PROFILES[demoUser] : realProfile;

  const [allExpenses, setAllExpenses] = useState(isDemo ? DEMO_ALL_EXPENSES : []);

  // Keep a ref so the retry closure always sees the latest expenses without re-subscribing
  const allExpensesRef = useRef(allExpenses);
  useEffect(() => { allExpensesRef.current = allExpenses; }, [allExpenses]);

  // Retry any receipts saved offline: runs on mount + whenever device comes back online
  useEffect(() => {
    const retry = async () => {
      if (!navigator.onLine) return;
      const pending = (allExpensesRef.current ?? []).filter(
        e => e.attachment?.pending && e.attachment?.receiptId,
      );
      for (const exp of pending) {
        try {
          const blob = await getReceiptBlob(exp.attachment.receiptId);
          if (!blob) continue;
          const fd = new FormData();
          fd.append('file', new File([blob], exp.attachment.name || 'receipt.jpg', { type: blob.type || 'image/jpeg' }));
          fd.append('upload_preset', CLOUDINARY_PRESET);
          const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd });
          const data = await res.json();
          if (data.secure_url) {
            const newAtt = { url: data.secure_url, name: exp.attachment.name };
            setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, attachment: newAtt } : e));
            setAllExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, attachment: newAtt } : e));
            if (!isDemo) updateDoc(doc(db, 'expenses', exp.id), { attachment: newAtt });
            deleteReceiptBlob(exp.attachment.receiptId);
          }
        } catch {}
      }
    };

    const t = setTimeout(retry, 1500); // slight delay so state is fully initialised
    window.addEventListener('online', retry);
    return () => { clearTimeout(t); window.removeEventListener('online', retry); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat account id → label map from settings
  const accountMap = Object.values(settings.accounts ?? {}).flat()
    .reduce((m, a) => { m[a.id] = a.label; return m; }, {});

  // Real-time Firestore listener (skipped in demo)
  useEffect(() => {
    if (isDemo) { setExpenses(DEMO_ALL_EXPENSES.filter(e => e.date.startsWith(month))); setLoading(false); return; }
    if (!user) { setExpenses([]); setLoading(false); return; }

    const [y, m] = month.split('-');
    const startDate = `${y}-${m}-01`;
    const endDate   = `${y}-${m}-${lastDay(y, m)}`;

    const q = query(
      collection(db, 'expenses'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc'),
    );

    setLoading(true);
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      docs.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
      });
      setExpenses(docs);
      setLoading(false);
    }, (err) => {
      console.error('Firestore error:', err);
      setLoading(false);
    });

    return unsub;
  }, [user, month, isDemo]);

  // 6-month listener for Trends (production only)
  useEffect(() => {
    if (isDemo || !user) return;
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    const sixMonthsAgo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const q = query(
      collection(db, 'expenses'),
      where('date', '>=', sixMonthsAgo),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllExpenses(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    }, (err) => console.error('Trends listener error:', err));
    return unsub;
  }, [user, isDemo]);

  const handleSave = async (data) => {
    if (isDemo) {
      if (editTarget) {
        const updated = { ...editTarget, ...data };
        setExpenses(prev => prev.map(e => e.id === editTarget.id ? updated : e));
        setAllExpenses(prev => prev.map(e => e.id === editTarget.id ? updated : e));
      } else {
        const newExp = { id: String(Date.now()), ...data, addedBy: profile.uid, addedByName: profile.displayName };
        setExpenses(prev => [newExp, ...prev]);
        setAllExpenses(prev => [newExp, ...prev]);
      }
      setShowModal(false); setEditTarget(null); return;
    }
    if (!profile) return;
    const payload = { ...data, addedBy: profile.uid, addedByName: profile.displayName, updatedAt: serverTimestamp() };
    if (editTarget) {
      await updateDoc(doc(db, 'expenses', editTarget.id), payload);
    } else {
      await addDoc(collection(db, 'expenses'), { ...payload, createdAt: serverTimestamp() });
    }
    setShowModal(false); setEditTarget(null);
  };

  const openAdd  = () => { setEditTarget(null); setShowModal(true); };
  const handleEdit = (exp) => { setEditTarget(exp); setShowModal(true); };

  const handlePresetSave = (preset) => {
    const today = new Date().toISOString().split('T')[0];
    const newExp = {
      id: String(Date.now()),
      type: 'expense',
      amount: preset.amount,
      currency: preset.currency ?? 'SGD',
      sgdAmount: preset.currency === 'SGD' ? preset.amount : null,
      category: preset.category,
      account: preset.account ?? null,
      payee: preset.payee ?? '',
      note: preset.note ?? '',
      tags: [],
      date: today,
      attachment: null,
      addedBy: profile?.uid,
      addedByName: profile?.displayName,
    };
    if (isDemo) {
      setExpenses(prev => [newExp, ...prev]);
      setAllExpenses(prev => [newExp, ...prev]);
      return;
    }
    const { id: _localId, ...newExpData } = newExp;
    addDoc(collection(db, 'expenses'), { ...newExpData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  };

  const handleDelete = async (id) => {
    if (isDemo) { setExpenses(prev => prev.filter(e => e.id !== id)); setAllExpenses(prev => prev.filter(e => e.id !== id)); return; }
    await deleteDoc(doc(db, 'expenses', id));
  };

  const stepMonth = (dir) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (!isDemo && user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isDemo && !user) return <Login />;

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
      {isDemo && (
        <div className="bg-amber-400 text-amber-900 text-xs font-semibold flex items-center justify-between py-1 px-3 fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
          <span>DEMO MODE</span>
          <div className="flex items-center gap-1">
            {Object.keys(DEMO_PROFILES).map(name => (
              <button
                key={name}
                onClick={() => setDemoUser(name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                  demoUser === name ? 'bg-amber-900 text-amber-100' : 'bg-amber-300 text-amber-800'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month nav bar — hidden on dashboard, shown on expenses/analytics */}
      {(tab !== 'dashboard' || showSettings) && (
        <header className={`fixed left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-[#ECEDF0] border-b border-gray-200 ${isDemo ? 'top-6' : 'top-0'}`}>
          <div className="flex items-center justify-between px-4 py-1">
            <button onClick={() => stepMonth(-1)} className="p-1 rounded-lg text-gray-500">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-gray-600">{formatMonthShort(month)}</span>
            <button
              onClick={() => stepMonth(1)}
              disabled={month >= currentYM()}
              className="p-1 rounded-lg text-gray-500 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </header>
      )}

      {/* Content */}
      <main className={tab === 'dashboard' && !showSettings ? 'pt-0' : isDemo ? 'pt-[62px]' : 'pt-[30px]'}>
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : showSettings ? (
          <Settings
            settings={settings}
            onSave={handleSaveSettings}
            onBack={() => setShowSettings(false)}
            profile={profile}
            dark={dark}
            onToggleDark={toggleDark}
            onLogout={() => !isDemo && signOut(auth)}
            isDemo={isDemo}
          />
        ) : tab === 'dashboard' && selectedCategory ? (
          <CategoryDetail
            categoryId={selectedCategory}
            currentMonth={month}
            isDemo={isDemo}
            allExpenses={isDemo ? DEMO_ALL_EXPENSES : null}
            onBack={() => setSelectedCategory(null)}
          />
        ) : tab === 'dashboard' ? (
          <Dashboard
            key={dashKey}
            expenses={expenses}
            allExpenses={allExpenses}
            month={month}
            onAdd={openAdd}
            onEdit={handleEdit}
            profile={profile}
            budget={settings.monthlyBudget ?? 5000}
            categorySettings={settings.categories}
            memberNames={Object.keys(settings.accounts ?? {})}
            onCategorySelect={setSelectedCategory}
            onOpenSettings={() => setShowSettings(true)}
            onTagSelect={handleTagSelect}
            onPayeeSelect={handlePayeeSelect}
            allowEditOthers={settings.allowEditOthers}
            presets={settings.presets ?? DEFAULT_PRESETS}
            onPresetSave={handlePresetSave}
          />
        ) : tab === 'analytics' ? (
          <Analytics
            allExpenses={allExpenses}
            currentMonth={month}
            accountMap={accountMap}
          />
        ) : (
          <Expenses
            expenses={expenses}
            onEdit={handleEdit}
            onDelete={handleDelete}
            profile={profile}
            allowEditOthers={settings.allowEditOthers}
            allExpenses={allExpenses}
            selectedTag={selectedTag}
            onClearTag={() => setSelectedTag(null)}
            onTagSelect={handleTagSelect}
            selectedAccount={selectedAccount}
            onClearAccount={() => setSelectedAccount(null)}
            onAccountSelect={handleAccountSelect}
            accountMap={accountMap}
            selectedPayee={selectedPayee}
            onClearPayee={() => setSelectedPayee(null)}
            onPayeeSelect={handlePayeeSelect}
          />
        )}
      </main>

      {/* Bottom nav — Axio style 4-tab */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center">
        <button onClick={() => { setShowSettings(false); setTab('dashboard'); setSelectedCategory(null); setDashKey(k => k + 1); }} className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium transition-colors ${tab === 'dashboard' && !showSettings ? 'text-indigo-600' : 'text-gray-400'}`}>
          <LayoutDashboard size={20} />
          <span>Home</span>
        </button>
        <button onClick={() => { setShowSettings(false); setTab('expenses'); setSelectedTag(null); setSelectedAccount(null); setSelectedPayee(null); }} className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium transition-colors ${tab === 'expenses' && !showSettings ? 'text-green-700' : 'text-gray-400'}`}>
          <List size={20} />
          <span>Expenses</span>
        </button>
        <button
          onClick={openAdd}
          className="flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium text-gray-400"
        >
          <div className="w-10 h-10 bg-green-900 rounded-full flex items-center justify-center -mt-6 shadow-lg">
            <Plus size={22} className="text-white" />
          </div>
          <span className="mt-0.5">Add</span>
        </button>
        <button onClick={() => { setShowSettings(false); setTab('analytics'); }} className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium transition-colors ${tab === 'analytics' && !showSettings ? 'text-indigo-600' : 'text-gray-400'}`}>
          <BarChart2 size={20} />
          <span>Analytics</span>
        </button>
      </nav>

      {showModal && (
        <ExpenseModal
          expense={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onDelete={handleDelete}
          profile={profile}
          availableTags={settings.tags}
          availableAccounts={settings.accounts}
          readOnly={!!(editTarget && editTarget.addedBy !== profile?.uid && !settings.allowEditOthers)}
        />
      )}
    </div>
  );
}

function lastDay(y, m) {
  return new Date(Number(y), Number(m), 0).getDate();
}

function formatMonthShort(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('en-SG', { month: 'short', year: 'numeric' });
}
