export type SortOrder = 'asc' | 'desc';
export interface PaginationQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: SortOrder;
}
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
export interface ApiError {
    statusCode: number;
    message: string;
    error?: string;
    details?: Record<string, string[]>;
}
//# sourceMappingURL=pagination.d.ts.map