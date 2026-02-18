import axios, { AxiosError } from "axios";

interface NinVerificationRequest {
  nin: string;
  consent?: boolean;
}

interface NinPhoneSearchRequest {
  phone: string;
  consent?: boolean;
}

interface NinDemographyRequest {
  firstname: string;
  lastname: string;
  gender: string;
  dob: string;
  consent?: boolean;
}

interface BvnVerificationRequest {
  bvn: string;
  consent?: boolean;
}

interface BvnPhoneSearchRequest {
  phone: string;
  consent?: boolean;
}

interface VerificationData {
  firstname?: string;
  middlename?: string;
  surname?: string;
  lastname?: string;
  telephoneno?: string;
  phone?: string;
  email?: string;
  residence_state?: string;
  residence_town?: string;
  residence_address?: string;
  residence_lga?: string;
  birthcountry?: string;
  birthstate?: string;
  birthlga?: string;
  state_of_origin?: string;
  state_of_residence?: string;
  gender?: string;
  nin?: string;
  bvn?: string;
  birthdate?: string;
  dob?: string;
  nationality?: string;
  photo?: string;
}

interface VerificationResponse {
  status: "success" | "error";
  reportID?: string;
  message: string;
  data?: VerificationData;
  code?: number;
}

class NinBvnVerificationService {
  private apiBaseUrl = "https://checkmyninbvn.com.ng/api";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NIN_BVN_API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "NIN_BVN_API_KEY environment variable is not set. NIN/BVN verification will not work."
      );
    }
  }

  /**
   * Verify NIN by NIN number
   * Cost: ₦150
   */
  async verifyNin(nin: string): Promise<VerificationResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }

      // Validate NIN format (should be 11 digits)
      if (!nin || !/^\d{11}$/.test(nin)) {
        return {
          status: "error",
          message: "Invalid NIN format. NIN must be exactly 11 digits",
          code: 400,
        };
      }

      const response = await axios.post<VerificationResponse>(
        `${this.apiBaseUrl}/nin-verification`,
        {
          nin,
          consent: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Search NIN by phone number
   * Cost: ₦250
   */
  async searchNinByPhone(phone: string): Promise<VerificationResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }

      // Validate phone format
      if (!phone || !/^(\d{10,11})$/.test(phone.replace(/\D/g, ""))) {
        return {
          status: "error",
          message: "Invalid phone format",
          code: 400,
        };
      }

      const response = await axios.post<VerificationResponse>(
        `${this.apiBaseUrl}/nin-phone`,
        {
          phone,
          consent: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Search NIN by demographic data
   * Cost: ₦300
   */
  async searchNinByDemography(
    firstname: string,
    lastname: string,
    gender: string,
    dob: string
  ): Promise<VerificationResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }

      // Validate required fields
      if (!firstname || !lastname || !gender || !dob) {
        return {
          status: "error",
          message:
            "Missing required fields: firstname, lastname, gender, dob",
          code: 400,
        };
      }

      const response = await axios.post<VerificationResponse>(
        `${this.apiBaseUrl}/nin-demography`,
        {
          firstname: firstname.toUpperCase(),
          lastname: lastname.toUpperCase(),
          gender: gender.toLowerCase(),
          dob,
          consent: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Verify BVN by BVN number
   * Cost: ₦150
   */
  async verifyBvn(bvn: string): Promise<VerificationResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }

      // Validate BVN format (should be 11 digits)
      if (!bvn || !/^\d{11}$/.test(bvn)) {
        return {
          status: "error",
          message: "Invalid BVN format. BVN must be exactly 11 digits",
          code: 400,
        };
      }

      const response = await axios.post<VerificationResponse>(
        `${this.apiBaseUrl}/bvn-verification`,
        {
          bvn,
          consent: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Search BVN by phone number
   * Cost: ₦250
   */
  async searchBvnByPhone(phone: string): Promise<VerificationResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }

      // Validate phone format
      if (!phone || !/^(\d{10,11})$/.test(phone.replace(/\D/g, ""))) {
        return {
          status: "error",
          message: "Invalid phone format",
          code: 400,
        };
      }

      const response = await axios.post<VerificationResponse>(
        `${this.apiBaseUrl}/bvn-phone`,
        {
          phone,
          consent: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Check account balance
   * Cost: Free
   */
  async checkBalance(): Promise<VerificationResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }

      const response = await axios.get<VerificationResponse>(
        `${this.apiBaseUrl}/balance`,
        {
          headers: {
            "x-api-key": this.apiKey,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): VerificationResponse {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // If we have a response with status and message, return it
      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        if (data.status === "error") {
          return {
            status: "error",
            message: data.message || "Verification failed",
            code: data.code || axiosError.response.status,
          };
        }
      }

      // Handle specific error cases
      if (axiosError.response?.status === 401) {
        return {
          status: "error",
          message: "Invalid API key",
          code: 401,
        };
      }

      if (axiosError.response?.status === 400) {
        return {
          status: "error",
          message:
            (axiosError.response?.data as any)?.message ||
            "Invalid request",
          code: 400,
        };
      }

      if (axiosError.code === "ECONNABORTED") {
        return {
          status: "error",
          message: "Request timeout",
          code: 408,
        };
      }

      return {
        status: "error",
        message: axiosError.message || "Verification service error",
        code: axiosError.response?.status || 500,
      };
    }

    // Handle non-axios errors
    if (error instanceof Error) {
      return {
        status: "error",
        message: error.message,
        code: 500,
      };
    }

    return {
      status: "error",
      message: "Unknown error occurred",
      code: 500,
    };
  }
}

// Export singleton instance
export const ninBvnService = new NinBvnVerificationService();
export default NinBvnVerificationService;
