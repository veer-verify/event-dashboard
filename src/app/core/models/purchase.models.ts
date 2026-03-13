export interface Product {
    id: number;
    productName: string;
    units: string;
    make: string;
    model: string;
    productCode: string;
    publishedDate: string;
    useFor: string;
}

export interface ProductsResponse {
    status: string;
    statusCode: number;
    message: string;
    data: Product[];
}

export interface PurchaseDetail {
    id: number;
    invoiceNumber: string;
    invoiceDate: string;
    purchaseFrom: string;
    deliveredTo: string;
    purchaseType: string;
    totalAmount: number;
    status: string;
    statusColor: string;
}

export interface SerialDetail {
    purchaseItemId: number;
    serialNumber: string;
    barcode: string;
    status: string;
}

export interface PurchaseItem {
    itemId: number;
    itemName: string;
    itemCode: string;
    make: string;
    model: string;
    serialNumberFlag?: string;
    barcodeFlag?: string;
    count: number;
    unitPrice: number;
    gstPercent: number;
    totalPricePerUnit: number;
    status: string;
    statusColor: string;
    serialDetails: SerialDetail[];
}

export interface PurchaseFile {
    id: number;
    fileType: string;
    storedFileName?: string;
    fileUrl?: string;
    filePath?: string; // Keep for backward compatibility if needed
}

export interface PurchaseDetailsData {
    purchase: PurchaseDetail;
    items: PurchaseItem[];
    files: PurchaseFile[];
}

export interface PurchaseDetailsResponse {
    status: string;
    statusCode: number;
    message: string;
    data: PurchaseDetailsData;
}
