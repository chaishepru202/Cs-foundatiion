export type Category = 'Food' | 'Salary' | 'Medicine' | 'Restaurant' | 'Cloth' | 'Fuel' | 'Transportation' | 'Education' | 'Office' | 'House' | 'Other';

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  category: Category;
  type: 'expense' | 'income';
  date: string;
  description: string;
}

export interface Budget {
  userId: string;
  category: Category;
  limit: number;
  spent: number;
}

export type MemberType = 'General Member' | 'Lifetime Member' | 'Blood Donor';

export interface Member {
  id: string;
  userId: string;
  name: string;
  role: 'admin' | 'member';
  memberType: MemberType;
  email: string;
  bloodGroup: string;
  phoneNumber: string;
  address: string;
  joinedDate: string;
}

export interface UserProfile {
  name: string;
  currency: string;
}

export interface News {
  id: string;
  userId: string;
  title: string;
  content: string;
  date: string;
  author: string;
  imageUrl?: string;
}

export interface Donor {
  id: string;
  userId: string;
  name: string;
  bloodGroup: string;
  phoneNumber: string;
  address: string;
  district: string;
  lastDonated?: string;
  joinedDate: string;
}

export interface FoundationRule {
  id: string;
  title: string;
  pdfData: string; // Base64 PDF
  uploadedBy: string;
  date: string;
}

export interface MemberDonation {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  month: string; // e.g., "2024-03"
  date: string;
  paymentMethod: string;
  transactionId?: string;
  status: 'pending' | 'verified';
}

export interface PublicDonation {
  id: string;
  donorName: string;
  donorPhone: string;
  amount: number;
  date: string;
  paymentMethod: string;
  transactionId?: string;
  message?: string;
  status: 'pending' | 'verified';
}

export interface SlideshowImage {
  id: string;
  url: string;
  title?: string;
  description?: string;
  date: string;
  uploadedBy: string;
}
