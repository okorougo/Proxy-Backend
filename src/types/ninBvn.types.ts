/**
 * NIN/BVN Verification Types
 * 
 * Type definitions for NIN and BVN verification
 */

/**
 * Personal data returned from NIN verification
 */
export interface NinData {
  firstname?: string;
  middlename?: string;
  surname?: string;
  telephoneno?: string;
  residence_state?: string;
  residence_town?: string;
  residence_address?: string;
  residence_lga?: string;
  birthcountry?: string;
  birthstate?: string;
  birthlga?: string;
  gender?: string;
  nin?: string;
  birthdate?: string;
  photo?: string;
}

/**
 * Personal data returned from BVN verification
 */
export interface BvnData {
  firstname?: string;
  middlename?: string;
  lastname?: string;
  phone?: string;
  email?: string;
  bvn?: string;
  dob?: string;
  gender?: string;
  state_of_origin?: string;
  state_of_residence?: string;
  nationality?: string;
  photo?: string;
}

/**
 * Generic verification data (union of NIN and BVN data)
 */
export type VerificationData = NinData | BvnData;

/**
 * Response from NIN/BVN verification API
 */
export interface VerificationResponse {
  status: "success" | "error";
  reportID?: string;
  message: string;
  data?: VerificationData;
  code?: number;
}

/**
 * KYC Verification record
 */
export interface KycVerificationRecord {
  id: string;
  userId: string;
  nin?: string;
  selfieUrl?: string;
  idCardUrl?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request body for NIN verification
 */
export interface VerifyNinRequest {
  nin: string;
}

/**
 * Request body for NIN phone search
 */
export interface SearchNinByPhoneRequest {
  phone: string;
}

/**
 * Request body for NIN demographic search
 */
export interface SearchNinByDemographyRequest {
  firstname: string;
  lastname: string;
  gender: string;
  dob: string;
}

/**
 * Request body for BVN verification
 */
export interface VerifyBvnRequest {
  bvn: string;
}

/**
 * Request body for BVN phone search
 */
export interface SearchBvnByPhoneRequest {
  phone: string;
}

/**
 * Success response with KYC and verification data
 */
export interface VerifyNinSuccessResponse {
  success: true;
  message: string;
  data: {
    kyc: KycVerificationRecord;
    verificationData: NinData;
    reportID: string;
  };
}

/**
 * Success response with verification data only
 */
export interface VerifyBvnSuccessResponse {
  success: true;
  message: string;
  data: {
    verificationData: BvnData;
    reportID: string;
  };
}

/**
 * Error response
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error: string;
  statusCode: number;
}

/**
 * Account balance data
 */
export interface AccountBalance {
  user_id: number;
  username: string;
  balance: number;
  formatted_balance: string;
  user_type: string;
  api_requests_today: number;
  api_limit: number;
}

/**
 * Balance check response
 */
export interface BalanceResponse {
  success: true;
  message: string;
  data: {
    balance: AccountBalance;
  };
}

/**
 * Combined response type for balance check
 */
export type BalanceCheckResponse = BalanceResponse | ErrorResponse;

/**
 * Combined response type for NIN verification
 */
export type NinVerificationResponse = VerifyNinSuccessResponse | ErrorResponse;

/**
 * Combined response type for BVN verification
 */
export type BvnVerificationResponse = VerifyBvnSuccessResponse | ErrorResponse;

/**
 * Combined response type for phone search (NIN)
 */
export type NinPhoneSearchResponse = VerifyNinSuccessResponse | ErrorResponse;

/**
 * Combined response type for demographics search (NIN)
 */
export type NinDemographySearchResponse = VerifyNinSuccessResponse | ErrorResponse;

/**
 * Combined response type for phone search (BVN)
 */
export type BvnPhoneSearchResponse = VerifyBvnSuccessResponse | ErrorResponse;

/**
 * Validation error type
 */
export class ValidationError extends Error {
  constructor(public message: string, public field: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * API error type
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public reportID?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * NIN validation options
 */
export interface NinValidationOptions {
  strict?: boolean; // Enforce strict 11-digit validation
  allowLeadingZeros?: boolean; // Allow leading zeros
}

/**
 * Phone validation options
 */
export interface PhoneValidationOptions {
  country?: "NG" | "US" | "GB"; // Country code
  strict?: boolean; // Enforce strict validation
}

/**
 * Email validation options
 */
export interface EmailValidationOptions {
  strict?: boolean; // Enforce strict RFC 5322 validation
}

/**
 * KYC update payload
 */
export interface UpdateKycPayload {
  nin?: string;
  selfieUrl?: string;
  idCardUrl?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionNote?: string;
}

/**
 * Service configuration
 */
export interface NinBvnServiceConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Logger interface
 */
export interface Logger {
  log(message: string, data?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}
