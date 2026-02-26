export interface Contact {
  id: number;
  phonenumber: string | null;
  email: string | null;
  linkedid: number | null;
  linkprecedence: "primary" | "secondary";
  createdat: string;
  updatedat: string;
  deletedat: string | null;
}

export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface IdentifyResponse {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}