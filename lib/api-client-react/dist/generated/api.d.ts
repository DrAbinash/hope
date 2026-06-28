import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { ActivityItem, Bed, BedAvailability, BillingSummary, ConversionReportItem, ConvertToIpdBody, CreateBedBody, CreateDoctorBody, CreateEntityBody, CreateInventoryItemBody, CreateInvoiceBody, CreateIpdAdmissionBody, CreateLedgerBody, CreateLedgerGroupBody, CreateMedicineBody, CreateOpdVisitBody, CreatePatientBody, CreatePharmacySaleBody, CreatePrescriptionTemplateBody, CreateVoucherBody, CreateWardBody, DashboardSummary, DiagnosisReportItem, DischargeBody, Doctor, DoctorWiseReportItem, Entity, EntitySummary, ExportToTallyParams, FinancialReport, GetDiagnosisWiseReportParams, GetDoctorWiseReportParams, GetFinancialReportParams, GetOpdToIpdReportParams, GetProfitLossParams, GetTrialBalanceParams, HealthStatus, InventoryItem, InventorySummary, Invoice, InvoiceListResponse, IpdAdmission, IpdAdmissionListResponse, Ledger, LedgerGroup, ListBedsParams, ListInventoryItemsParams, ListInvoicesParams, ListIpdAdmissionsParams, ListLedgersParams, ListMedicinesParams, ListOpdVisitsParams, ListPatientsParams, ListPharmacySalesParams, ListPrescriptionTemplatesParams, ListVouchersParams, Medicine, OpdVisit, OpdVisitListResponse, Patient, PatientHistory, PatientListResponse, PharmacySale, PharmacySaleListResponse, PharmacyStockSummary, PrescriptionTemplate, ProfitLoss, StorageErrorEnvelope, TallyExportResult, TrialBalance, UpdateInvoiceBody, UpdateIpdAdmissionBody, UpdateOpdVisitBody, UploadUrlRequest, UploadUrlResponse, Voucher, VoucherListResponse, Ward } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * @summary Request a presigned URL for file upload
 */
export declare const getRequestUploadUrlUrl: () => string;
export declare const requestUploadUrl: (uploadUrlRequest: UploadUrlRequest, options?: RequestInit) => Promise<UploadUrlResponse>;
export declare const getRequestUploadUrlMutationOptions: <TError = ErrorType<StorageErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadUrlRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadUrlRequest>;
}, TContext>;
export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>;
export type RequestUploadUrlMutationBody = BodyType<UploadUrlRequest>;
export type RequestUploadUrlMutationError = ErrorType<StorageErrorEnvelope>;
/**
 * @summary Request a presigned URL for file upload
 */
export declare const useRequestUploadUrl: <TError = ErrorType<StorageErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadUrlRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadUrlRequest>;
}, TContext>;
/**
 * @summary Serve a public asset
 */
export declare const getGetPublicObjectUrl: (filePath: string) => string;
export declare const getPublicObject: (filePath: string, options?: RequestInit) => Promise<Blob>;
export declare const getGetPublicObjectQueryKey: (filePath: string) => readonly [`/api/storage/public-objects/${string}`];
export declare const getGetPublicObjectQueryOptions: <TData = Awaited<ReturnType<typeof getPublicObject>>, TError = ErrorType<StorageErrorEnvelope>>(filePath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPublicObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getPublicObject>>>;
export type GetPublicObjectQueryError = ErrorType<StorageErrorEnvelope>;
/**
 * @summary Serve a public asset
 */
export declare function useGetPublicObject<TData = Awaited<ReturnType<typeof getPublicObject>>, TError = ErrorType<StorageErrorEnvelope>>(filePath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Serve an object entity from PRIVATE_OBJECT_DIR
 */
export declare const getGetStorageObjectUrl: (objectPath: string) => string;
export declare const getStorageObject: (objectPath: string, options?: RequestInit) => Promise<Blob>;
export declare const getGetStorageObjectQueryKey: (objectPath: string) => readonly [`/api/storage/objects/${string}`];
export declare const getGetStorageObjectQueryOptions: <TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<StorageErrorEnvelope>>(objectPath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetStorageObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getStorageObject>>>;
export type GetStorageObjectQueryError = ErrorType<StorageErrorEnvelope>;
/**
 * @summary Serve an object entity from PRIVATE_OBJECT_DIR
 */
export declare function useGetStorageObject<TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<StorageErrorEnvelope>>(objectPath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all legal entities
 */
export declare const getListEntitiesUrl: () => string;
export declare const listEntities: (options?: RequestInit) => Promise<Entity[]>;
export declare const getListEntitiesQueryKey: () => readonly ["/api/entities"];
export declare const getListEntitiesQueryOptions: <TData = Awaited<ReturnType<typeof listEntities>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEntities>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listEntities>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListEntitiesQueryResult = NonNullable<Awaited<ReturnType<typeof listEntities>>>;
export type ListEntitiesQueryError = ErrorType<unknown>;
/**
 * @summary List all legal entities
 */
export declare function useListEntities<TData = Awaited<ReturnType<typeof listEntities>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEntities>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create new entity
 */
export declare const getCreateEntityUrl: () => string;
export declare const createEntity: (createEntityBody: CreateEntityBody, options?: RequestInit) => Promise<Entity>;
export declare const getCreateEntityMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEntity>>, TError, {
        data: BodyType<CreateEntityBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createEntity>>, TError, {
    data: BodyType<CreateEntityBody>;
}, TContext>;
export type CreateEntityMutationResult = NonNullable<Awaited<ReturnType<typeof createEntity>>>;
export type CreateEntityMutationBody = BodyType<CreateEntityBody>;
export type CreateEntityMutationError = ErrorType<unknown>;
/**
 * @summary Create new entity
 */
export declare const useCreateEntity: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEntity>>, TError, {
        data: BodyType<CreateEntityBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createEntity>>, TError, {
    data: BodyType<CreateEntityBody>;
}, TContext>;
/**
 * @summary Update entity
 */
export declare const getUpdateEntityUrl: (id: number) => string;
export declare const updateEntity: (id: number, createEntityBody: CreateEntityBody, options?: RequestInit) => Promise<Entity>;
export declare const getUpdateEntityMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEntity>>, TError, {
        id: number;
        data: BodyType<CreateEntityBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateEntity>>, TError, {
    id: number;
    data: BodyType<CreateEntityBody>;
}, TContext>;
export type UpdateEntityMutationResult = NonNullable<Awaited<ReturnType<typeof updateEntity>>>;
export type UpdateEntityMutationBody = BodyType<CreateEntityBody>;
export type UpdateEntityMutationError = ErrorType<unknown>;
/**
 * @summary Update entity
 */
export declare const useUpdateEntity: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEntity>>, TError, {
        id: number;
        data: BodyType<CreateEntityBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateEntity>>, TError, {
    id: number;
    data: BodyType<CreateEntityBody>;
}, TContext>;
/**
 * @summary Per-entity financial summary
 */
export declare const getGetEntitiesSummaryUrl: () => string;
export declare const getEntitiesSummary: (options?: RequestInit) => Promise<EntitySummary[]>;
export declare const getGetEntitiesSummaryQueryKey: () => readonly ["/api/entities/summary"];
export declare const getGetEntitiesSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getEntitiesSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEntitiesSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getEntitiesSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetEntitiesSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getEntitiesSummary>>>;
export type GetEntitiesSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Per-entity financial summary
 */
export declare function useGetEntitiesSummary<TData = Awaited<ReturnType<typeof getEntitiesSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEntitiesSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get dashboard summary stats
 */
export declare const getGetDashboardSummaryUrl: () => string;
export declare const getDashboardSummary: (options?: RequestInit) => Promise<DashboardSummary>;
export declare const getGetDashboardSummaryQueryKey: () => readonly ["/api/dashboard/summary"];
export declare const getGetDashboardSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>>;
export type GetDashboardSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get dashboard summary stats
 */
export declare function useGetDashboardSummary<TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get recent activity feed
 */
export declare const getGetRecentActivityUrl: () => string;
export declare const getRecentActivity: (options?: RequestInit) => Promise<ActivityItem[]>;
export declare const getGetRecentActivityQueryKey: () => readonly ["/api/dashboard/recent-activity"];
export declare const getGetRecentActivityQueryOptions: <TData = Awaited<ReturnType<typeof getRecentActivity>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetRecentActivityQueryResult = NonNullable<Awaited<ReturnType<typeof getRecentActivity>>>;
export type GetRecentActivityQueryError = ErrorType<unknown>;
/**
 * @summary Get recent activity feed
 */
export declare function useGetRecentActivity<TData = Awaited<ReturnType<typeof getRecentActivity>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all patients
 */
export declare const getListPatientsUrl: (params?: ListPatientsParams) => string;
export declare const listPatients: (params?: ListPatientsParams, options?: RequestInit) => Promise<PatientListResponse>;
export declare const getListPatientsQueryKey: (params?: ListPatientsParams) => readonly ["/api/patients", ...ListPatientsParams[]];
export declare const getListPatientsQueryOptions: <TData = Awaited<ReturnType<typeof listPatients>>, TError = ErrorType<unknown>>(params?: ListPatientsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPatients>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPatients>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPatientsQueryResult = NonNullable<Awaited<ReturnType<typeof listPatients>>>;
export type ListPatientsQueryError = ErrorType<unknown>;
/**
 * @summary List all patients
 */
export declare function useListPatients<TData = Awaited<ReturnType<typeof listPatients>>, TError = ErrorType<unknown>>(params?: ListPatientsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPatients>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Register a new patient
 */
export declare const getCreatePatientUrl: () => string;
export declare const createPatient: (createPatientBody: CreatePatientBody, options?: RequestInit) => Promise<Patient>;
export declare const getCreatePatientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPatient>>, TError, {
        data: BodyType<CreatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPatient>>, TError, {
    data: BodyType<CreatePatientBody>;
}, TContext>;
export type CreatePatientMutationResult = NonNullable<Awaited<ReturnType<typeof createPatient>>>;
export type CreatePatientMutationBody = BodyType<CreatePatientBody>;
export type CreatePatientMutationError = ErrorType<unknown>;
/**
 * @summary Register a new patient
 */
export declare const useCreatePatient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPatient>>, TError, {
        data: BodyType<CreatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPatient>>, TError, {
    data: BodyType<CreatePatientBody>;
}, TContext>;
/**
 * @summary Get patient by ID
 */
export declare const getGetPatientUrl: (id: number) => string;
export declare const getPatient: (id: number, options?: RequestInit) => Promise<Patient>;
export declare const getGetPatientQueryKey: (id: number) => readonly [`/api/patients/${number}`];
export declare const getGetPatientQueryOptions: <TData = Awaited<ReturnType<typeof getPatient>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPatient>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPatient>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPatientQueryResult = NonNullable<Awaited<ReturnType<typeof getPatient>>>;
export type GetPatientQueryError = ErrorType<unknown>;
/**
 * @summary Get patient by ID
 */
export declare function useGetPatient<TData = Awaited<ReturnType<typeof getPatient>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPatient>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update patient
 */
export declare const getUpdatePatientUrl: (id: number) => string;
export declare const updatePatient: (id: number, createPatientBody: CreatePatientBody, options?: RequestInit) => Promise<Patient>;
export declare const getUpdatePatientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePatient>>, TError, {
        id: number;
        data: BodyType<CreatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePatient>>, TError, {
    id: number;
    data: BodyType<CreatePatientBody>;
}, TContext>;
export type UpdatePatientMutationResult = NonNullable<Awaited<ReturnType<typeof updatePatient>>>;
export type UpdatePatientMutationBody = BodyType<CreatePatientBody>;
export type UpdatePatientMutationError = ErrorType<unknown>;
/**
 * @summary Update patient
 */
export declare const useUpdatePatient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePatient>>, TError, {
        id: number;
        data: BodyType<CreatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePatient>>, TError, {
    id: number;
    data: BodyType<CreatePatientBody>;
}, TContext>;
/**
 * @summary Get full patient history (OPD + IPD)
 */
export declare const getGetPatientHistoryUrl: (id: number) => string;
export declare const getPatientHistory: (id: number, options?: RequestInit) => Promise<PatientHistory>;
export declare const getGetPatientHistoryQueryKey: (id: number) => readonly [`/api/patients/${number}/history`];
export declare const getGetPatientHistoryQueryOptions: <TData = Awaited<ReturnType<typeof getPatientHistory>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPatientHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPatientHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPatientHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof getPatientHistory>>>;
export type GetPatientHistoryQueryError = ErrorType<unknown>;
/**
 * @summary Get full patient history (OPD + IPD)
 */
export declare function useGetPatientHistory<TData = Awaited<ReturnType<typeof getPatientHistory>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPatientHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all doctors
 */
export declare const getListDoctorsUrl: () => string;
export declare const listDoctors: (options?: RequestInit) => Promise<Doctor[]>;
export declare const getListDoctorsQueryKey: () => readonly ["/api/doctors"];
export declare const getListDoctorsQueryOptions: <TData = Awaited<ReturnType<typeof listDoctors>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDoctors>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listDoctors>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListDoctorsQueryResult = NonNullable<Awaited<ReturnType<typeof listDoctors>>>;
export type ListDoctorsQueryError = ErrorType<unknown>;
/**
 * @summary List all doctors
 */
export declare function useListDoctors<TData = Awaited<ReturnType<typeof listDoctors>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDoctors>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Add a doctor
 */
export declare const getCreateDoctorUrl: () => string;
export declare const createDoctor: (createDoctorBody: CreateDoctorBody, options?: RequestInit) => Promise<Doctor>;
export declare const getCreateDoctorMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDoctor>>, TError, {
        data: BodyType<CreateDoctorBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createDoctor>>, TError, {
    data: BodyType<CreateDoctorBody>;
}, TContext>;
export type CreateDoctorMutationResult = NonNullable<Awaited<ReturnType<typeof createDoctor>>>;
export type CreateDoctorMutationBody = BodyType<CreateDoctorBody>;
export type CreateDoctorMutationError = ErrorType<unknown>;
/**
 * @summary Add a doctor
 */
export declare const useCreateDoctor: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDoctor>>, TError, {
        data: BodyType<CreateDoctorBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createDoctor>>, TError, {
    data: BodyType<CreateDoctorBody>;
}, TContext>;
/**
 * @summary Get doctor by ID
 */
export declare const getGetDoctorUrl: (id: number) => string;
export declare const getDoctor: (id: number, options?: RequestInit) => Promise<Doctor>;
export declare const getGetDoctorQueryKey: (id: number) => readonly [`/api/doctors/${number}`];
export declare const getGetDoctorQueryOptions: <TData = Awaited<ReturnType<typeof getDoctor>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDoctor>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDoctor>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDoctorQueryResult = NonNullable<Awaited<ReturnType<typeof getDoctor>>>;
export type GetDoctorQueryError = ErrorType<unknown>;
/**
 * @summary Get doctor by ID
 */
export declare function useGetDoctor<TData = Awaited<ReturnType<typeof getDoctor>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDoctor>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update doctor
 */
export declare const getUpdateDoctorUrl: (id: number) => string;
export declare const updateDoctor: (id: number, createDoctorBody: CreateDoctorBody, options?: RequestInit) => Promise<Doctor>;
export declare const getUpdateDoctorMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDoctor>>, TError, {
        id: number;
        data: BodyType<CreateDoctorBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateDoctor>>, TError, {
    id: number;
    data: BodyType<CreateDoctorBody>;
}, TContext>;
export type UpdateDoctorMutationResult = NonNullable<Awaited<ReturnType<typeof updateDoctor>>>;
export type UpdateDoctorMutationBody = BodyType<CreateDoctorBody>;
export type UpdateDoctorMutationError = ErrorType<unknown>;
/**
 * @summary Update doctor
 */
export declare const useUpdateDoctor: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDoctor>>, TError, {
        id: number;
        data: BodyType<CreateDoctorBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateDoctor>>, TError, {
    id: number;
    data: BodyType<CreateDoctorBody>;
}, TContext>;
/**
 * @summary List prescription templates
 */
export declare const getListPrescriptionTemplatesUrl: (params?: ListPrescriptionTemplatesParams) => string;
export declare const listPrescriptionTemplates: (params?: ListPrescriptionTemplatesParams, options?: RequestInit) => Promise<PrescriptionTemplate[]>;
export declare const getListPrescriptionTemplatesQueryKey: (params?: ListPrescriptionTemplatesParams) => readonly ["/api/prescription-templates", ...ListPrescriptionTemplatesParams[]];
export declare const getListPrescriptionTemplatesQueryOptions: <TData = Awaited<ReturnType<typeof listPrescriptionTemplates>>, TError = ErrorType<unknown>>(params?: ListPrescriptionTemplatesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPrescriptionTemplates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPrescriptionTemplates>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPrescriptionTemplatesQueryResult = NonNullable<Awaited<ReturnType<typeof listPrescriptionTemplates>>>;
export type ListPrescriptionTemplatesQueryError = ErrorType<unknown>;
/**
 * @summary List prescription templates
 */
export declare function useListPrescriptionTemplates<TData = Awaited<ReturnType<typeof listPrescriptionTemplates>>, TError = ErrorType<unknown>>(params?: ListPrescriptionTemplatesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPrescriptionTemplates>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a prescription template
 */
export declare const getCreatePrescriptionTemplateUrl: () => string;
export declare const createPrescriptionTemplate: (createPrescriptionTemplateBody: CreatePrescriptionTemplateBody, options?: RequestInit) => Promise<PrescriptionTemplate>;
export declare const getCreatePrescriptionTemplateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPrescriptionTemplate>>, TError, {
        data: BodyType<CreatePrescriptionTemplateBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPrescriptionTemplate>>, TError, {
    data: BodyType<CreatePrescriptionTemplateBody>;
}, TContext>;
export type CreatePrescriptionTemplateMutationResult = NonNullable<Awaited<ReturnType<typeof createPrescriptionTemplate>>>;
export type CreatePrescriptionTemplateMutationBody = BodyType<CreatePrescriptionTemplateBody>;
export type CreatePrescriptionTemplateMutationError = ErrorType<unknown>;
/**
 * @summary Create a prescription template
 */
export declare const useCreatePrescriptionTemplate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPrescriptionTemplate>>, TError, {
        data: BodyType<CreatePrescriptionTemplateBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPrescriptionTemplate>>, TError, {
    data: BodyType<CreatePrescriptionTemplateBody>;
}, TContext>;
/**
 * @summary Get template by ID
 */
export declare const getGetPrescriptionTemplateUrl: (id: number) => string;
export declare const getPrescriptionTemplate: (id: number, options?: RequestInit) => Promise<PrescriptionTemplate>;
export declare const getGetPrescriptionTemplateQueryKey: (id: number) => readonly [`/api/prescription-templates/${number}`];
export declare const getGetPrescriptionTemplateQueryOptions: <TData = Awaited<ReturnType<typeof getPrescriptionTemplate>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPrescriptionTemplate>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPrescriptionTemplate>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPrescriptionTemplateQueryResult = NonNullable<Awaited<ReturnType<typeof getPrescriptionTemplate>>>;
export type GetPrescriptionTemplateQueryError = ErrorType<unknown>;
/**
 * @summary Get template by ID
 */
export declare function useGetPrescriptionTemplate<TData = Awaited<ReturnType<typeof getPrescriptionTemplate>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPrescriptionTemplate>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update template
 */
export declare const getUpdatePrescriptionTemplateUrl: (id: number) => string;
export declare const updatePrescriptionTemplate: (id: number, createPrescriptionTemplateBody: CreatePrescriptionTemplateBody, options?: RequestInit) => Promise<PrescriptionTemplate>;
export declare const getUpdatePrescriptionTemplateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePrescriptionTemplate>>, TError, {
        id: number;
        data: BodyType<CreatePrescriptionTemplateBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePrescriptionTemplate>>, TError, {
    id: number;
    data: BodyType<CreatePrescriptionTemplateBody>;
}, TContext>;
export type UpdatePrescriptionTemplateMutationResult = NonNullable<Awaited<ReturnType<typeof updatePrescriptionTemplate>>>;
export type UpdatePrescriptionTemplateMutationBody = BodyType<CreatePrescriptionTemplateBody>;
export type UpdatePrescriptionTemplateMutationError = ErrorType<unknown>;
/**
 * @summary Update template
 */
export declare const useUpdatePrescriptionTemplate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePrescriptionTemplate>>, TError, {
        id: number;
        data: BodyType<CreatePrescriptionTemplateBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePrescriptionTemplate>>, TError, {
    id: number;
    data: BodyType<CreatePrescriptionTemplateBody>;
}, TContext>;
/**
 * @summary Delete template
 */
export declare const getDeletePrescriptionTemplateUrl: (id: number) => string;
export declare const deletePrescriptionTemplate: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeletePrescriptionTemplateMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePrescriptionTemplate>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePrescriptionTemplate>>, TError, {
    id: number;
}, TContext>;
export type DeletePrescriptionTemplateMutationResult = NonNullable<Awaited<ReturnType<typeof deletePrescriptionTemplate>>>;
export type DeletePrescriptionTemplateMutationError = ErrorType<unknown>;
/**
 * @summary Delete template
 */
export declare const useDeletePrescriptionTemplate: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePrescriptionTemplate>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePrescriptionTemplate>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary List OPD visits
 */
export declare const getListOpdVisitsUrl: (params?: ListOpdVisitsParams) => string;
export declare const listOpdVisits: (params?: ListOpdVisitsParams, options?: RequestInit) => Promise<OpdVisitListResponse>;
export declare const getListOpdVisitsQueryKey: (params?: ListOpdVisitsParams) => readonly ["/api/opd", ...ListOpdVisitsParams[]];
export declare const getListOpdVisitsQueryOptions: <TData = Awaited<ReturnType<typeof listOpdVisits>>, TError = ErrorType<unknown>>(params?: ListOpdVisitsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOpdVisits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listOpdVisits>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListOpdVisitsQueryResult = NonNullable<Awaited<ReturnType<typeof listOpdVisits>>>;
export type ListOpdVisitsQueryError = ErrorType<unknown>;
/**
 * @summary List OPD visits
 */
export declare function useListOpdVisits<TData = Awaited<ReturnType<typeof listOpdVisits>>, TError = ErrorType<unknown>>(params?: ListOpdVisitsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOpdVisits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create OPD visit (register patient visit)
 */
export declare const getCreateOpdVisitUrl: () => string;
export declare const createOpdVisit: (createOpdVisitBody: CreateOpdVisitBody, options?: RequestInit) => Promise<OpdVisit>;
export declare const getCreateOpdVisitMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOpdVisit>>, TError, {
        data: BodyType<CreateOpdVisitBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createOpdVisit>>, TError, {
    data: BodyType<CreateOpdVisitBody>;
}, TContext>;
export type CreateOpdVisitMutationResult = NonNullable<Awaited<ReturnType<typeof createOpdVisit>>>;
export type CreateOpdVisitMutationBody = BodyType<CreateOpdVisitBody>;
export type CreateOpdVisitMutationError = ErrorType<unknown>;
/**
 * @summary Create OPD visit (register patient visit)
 */
export declare const useCreateOpdVisit: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOpdVisit>>, TError, {
        data: BodyType<CreateOpdVisitBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createOpdVisit>>, TError, {
    data: BodyType<CreateOpdVisitBody>;
}, TContext>;
/**
 * @summary Get OPD visit by ID
 */
export declare const getGetOpdVisitUrl: (id: number) => string;
export declare const getOpdVisit: (id: number, options?: RequestInit) => Promise<OpdVisit>;
export declare const getGetOpdVisitQueryKey: (id: number) => readonly [`/api/opd/${number}`];
export declare const getGetOpdVisitQueryOptions: <TData = Awaited<ReturnType<typeof getOpdVisit>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOpdVisit>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOpdVisit>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOpdVisitQueryResult = NonNullable<Awaited<ReturnType<typeof getOpdVisit>>>;
export type GetOpdVisitQueryError = ErrorType<unknown>;
/**
 * @summary Get OPD visit by ID
 */
export declare function useGetOpdVisit<TData = Awaited<ReturnType<typeof getOpdVisit>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOpdVisit>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update OPD visit (add prescription, diagnosis, vitals)
 */
export declare const getUpdateOpdVisitUrl: (id: number) => string;
export declare const updateOpdVisit: (id: number, updateOpdVisitBody: UpdateOpdVisitBody, options?: RequestInit) => Promise<OpdVisit>;
export declare const getUpdateOpdVisitMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOpdVisit>>, TError, {
        id: number;
        data: BodyType<UpdateOpdVisitBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOpdVisit>>, TError, {
    id: number;
    data: BodyType<UpdateOpdVisitBody>;
}, TContext>;
export type UpdateOpdVisitMutationResult = NonNullable<Awaited<ReturnType<typeof updateOpdVisit>>>;
export type UpdateOpdVisitMutationBody = BodyType<UpdateOpdVisitBody>;
export type UpdateOpdVisitMutationError = ErrorType<unknown>;
/**
 * @summary Update OPD visit (add prescription, diagnosis, vitals)
 */
export declare const useUpdateOpdVisit: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOpdVisit>>, TError, {
        id: number;
        data: BodyType<UpdateOpdVisitBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOpdVisit>>, TError, {
    id: number;
    data: BodyType<UpdateOpdVisitBody>;
}, TContext>;
/**
 * @summary Convert OPD visit to IPD admission
 */
export declare const getConvertOpdToIpdUrl: (id: number) => string;
export declare const convertOpdToIpd: (id: number, convertToIpdBody: ConvertToIpdBody, options?: RequestInit) => Promise<IpdAdmission>;
export declare const getConvertOpdToIpdMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof convertOpdToIpd>>, TError, {
        id: number;
        data: BodyType<ConvertToIpdBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof convertOpdToIpd>>, TError, {
    id: number;
    data: BodyType<ConvertToIpdBody>;
}, TContext>;
export type ConvertOpdToIpdMutationResult = NonNullable<Awaited<ReturnType<typeof convertOpdToIpd>>>;
export type ConvertOpdToIpdMutationBody = BodyType<ConvertToIpdBody>;
export type ConvertOpdToIpdMutationError = ErrorType<unknown>;
/**
 * @summary Convert OPD visit to IPD admission
 */
export declare const useConvertOpdToIpd: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof convertOpdToIpd>>, TError, {
        id: number;
        data: BodyType<ConvertToIpdBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof convertOpdToIpd>>, TError, {
    id: number;
    data: BodyType<ConvertToIpdBody>;
}, TContext>;
/**
 * @summary List IPD admissions
 */
export declare const getListIpdAdmissionsUrl: (params?: ListIpdAdmissionsParams) => string;
export declare const listIpdAdmissions: (params?: ListIpdAdmissionsParams, options?: RequestInit) => Promise<IpdAdmissionListResponse>;
export declare const getListIpdAdmissionsQueryKey: (params?: ListIpdAdmissionsParams) => readonly ["/api/ipd", ...ListIpdAdmissionsParams[]];
export declare const getListIpdAdmissionsQueryOptions: <TData = Awaited<ReturnType<typeof listIpdAdmissions>>, TError = ErrorType<unknown>>(params?: ListIpdAdmissionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listIpdAdmissions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listIpdAdmissions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListIpdAdmissionsQueryResult = NonNullable<Awaited<ReturnType<typeof listIpdAdmissions>>>;
export type ListIpdAdmissionsQueryError = ErrorType<unknown>;
/**
 * @summary List IPD admissions
 */
export declare function useListIpdAdmissions<TData = Awaited<ReturnType<typeof listIpdAdmissions>>, TError = ErrorType<unknown>>(params?: ListIpdAdmissionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listIpdAdmissions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create direct IPD admission
 */
export declare const getCreateIpdAdmissionUrl: () => string;
export declare const createIpdAdmission: (createIpdAdmissionBody: CreateIpdAdmissionBody, options?: RequestInit) => Promise<IpdAdmission>;
export declare const getCreateIpdAdmissionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createIpdAdmission>>, TError, {
        data: BodyType<CreateIpdAdmissionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createIpdAdmission>>, TError, {
    data: BodyType<CreateIpdAdmissionBody>;
}, TContext>;
export type CreateIpdAdmissionMutationResult = NonNullable<Awaited<ReturnType<typeof createIpdAdmission>>>;
export type CreateIpdAdmissionMutationBody = BodyType<CreateIpdAdmissionBody>;
export type CreateIpdAdmissionMutationError = ErrorType<unknown>;
/**
 * @summary Create direct IPD admission
 */
export declare const useCreateIpdAdmission: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createIpdAdmission>>, TError, {
        data: BodyType<CreateIpdAdmissionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createIpdAdmission>>, TError, {
    data: BodyType<CreateIpdAdmissionBody>;
}, TContext>;
/**
 * @summary Get IPD admission by ID
 */
export declare const getGetIpdAdmissionUrl: (id: number) => string;
export declare const getIpdAdmission: (id: number, options?: RequestInit) => Promise<IpdAdmission>;
export declare const getGetIpdAdmissionQueryKey: (id: number) => readonly [`/api/ipd/${number}`];
export declare const getGetIpdAdmissionQueryOptions: <TData = Awaited<ReturnType<typeof getIpdAdmission>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getIpdAdmission>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getIpdAdmission>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetIpdAdmissionQueryResult = NonNullable<Awaited<ReturnType<typeof getIpdAdmission>>>;
export type GetIpdAdmissionQueryError = ErrorType<unknown>;
/**
 * @summary Get IPD admission by ID
 */
export declare function useGetIpdAdmission<TData = Awaited<ReturnType<typeof getIpdAdmission>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getIpdAdmission>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update IPD admission
 */
export declare const getUpdateIpdAdmissionUrl: (id: number) => string;
export declare const updateIpdAdmission: (id: number, updateIpdAdmissionBody: UpdateIpdAdmissionBody, options?: RequestInit) => Promise<IpdAdmission>;
export declare const getUpdateIpdAdmissionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateIpdAdmission>>, TError, {
        id: number;
        data: BodyType<UpdateIpdAdmissionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateIpdAdmission>>, TError, {
    id: number;
    data: BodyType<UpdateIpdAdmissionBody>;
}, TContext>;
export type UpdateIpdAdmissionMutationResult = NonNullable<Awaited<ReturnType<typeof updateIpdAdmission>>>;
export type UpdateIpdAdmissionMutationBody = BodyType<UpdateIpdAdmissionBody>;
export type UpdateIpdAdmissionMutationError = ErrorType<unknown>;
/**
 * @summary Update IPD admission
 */
export declare const useUpdateIpdAdmission: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateIpdAdmission>>, TError, {
        id: number;
        data: BodyType<UpdateIpdAdmissionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateIpdAdmission>>, TError, {
    id: number;
    data: BodyType<UpdateIpdAdmissionBody>;
}, TContext>;
/**
 * @summary Discharge IPD patient (auto-generate discharge summary)
 */
export declare const getDischargePatientUrl: (id: number) => string;
export declare const dischargePatient: (id: number, dischargeBody: DischargeBody, options?: RequestInit) => Promise<IpdAdmission>;
export declare const getDischargePatientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof dischargePatient>>, TError, {
        id: number;
        data: BodyType<DischargeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof dischargePatient>>, TError, {
    id: number;
    data: BodyType<DischargeBody>;
}, TContext>;
export type DischargePatientMutationResult = NonNullable<Awaited<ReturnType<typeof dischargePatient>>>;
export type DischargePatientMutationBody = BodyType<DischargeBody>;
export type DischargePatientMutationError = ErrorType<unknown>;
/**
 * @summary Discharge IPD patient (auto-generate discharge summary)
 */
export declare const useDischargePatient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof dischargePatient>>, TError, {
        id: number;
        data: BodyType<DischargeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof dischargePatient>>, TError, {
    id: number;
    data: BodyType<DischargeBody>;
}, TContext>;
/**
 * @summary List wards
 */
export declare const getListWardsUrl: () => string;
export declare const listWards: (options?: RequestInit) => Promise<Ward[]>;
export declare const getListWardsQueryKey: () => readonly ["/api/wards"];
export declare const getListWardsQueryOptions: <TData = Awaited<ReturnType<typeof listWards>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listWards>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listWards>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListWardsQueryResult = NonNullable<Awaited<ReturnType<typeof listWards>>>;
export type ListWardsQueryError = ErrorType<unknown>;
/**
 * @summary List wards
 */
export declare function useListWards<TData = Awaited<ReturnType<typeof listWards>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listWards>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create ward
 */
export declare const getCreateWardUrl: () => string;
export declare const createWard: (createWardBody: CreateWardBody, options?: RequestInit) => Promise<Ward>;
export declare const getCreateWardMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWard>>, TError, {
        data: BodyType<CreateWardBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createWard>>, TError, {
    data: BodyType<CreateWardBody>;
}, TContext>;
export type CreateWardMutationResult = NonNullable<Awaited<ReturnType<typeof createWard>>>;
export type CreateWardMutationBody = BodyType<CreateWardBody>;
export type CreateWardMutationError = ErrorType<unknown>;
/**
 * @summary Create ward
 */
export declare const useCreateWard: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWard>>, TError, {
        data: BodyType<CreateWardBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createWard>>, TError, {
    data: BodyType<CreateWardBody>;
}, TContext>;
/**
 * @summary Get bed availability summary
 */
export declare const getGetBedAvailabilityUrl: () => string;
export declare const getBedAvailability: (options?: RequestInit) => Promise<BedAvailability[]>;
export declare const getGetBedAvailabilityQueryKey: () => readonly ["/api/wards/bed-availability"];
export declare const getGetBedAvailabilityQueryOptions: <TData = Awaited<ReturnType<typeof getBedAvailability>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBedAvailability>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBedAvailability>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBedAvailabilityQueryResult = NonNullable<Awaited<ReturnType<typeof getBedAvailability>>>;
export type GetBedAvailabilityQueryError = ErrorType<unknown>;
/**
 * @summary Get bed availability summary
 */
export declare function useGetBedAvailability<TData = Awaited<ReturnType<typeof getBedAvailability>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBedAvailability>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List beds
 */
export declare const getListBedsUrl: (params?: ListBedsParams) => string;
export declare const listBeds: (params?: ListBedsParams, options?: RequestInit) => Promise<Bed[]>;
export declare const getListBedsQueryKey: (params?: ListBedsParams) => readonly ["/api/beds", ...ListBedsParams[]];
export declare const getListBedsQueryOptions: <TData = Awaited<ReturnType<typeof listBeds>>, TError = ErrorType<unknown>>(params?: ListBedsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBeds>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listBeds>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListBedsQueryResult = NonNullable<Awaited<ReturnType<typeof listBeds>>>;
export type ListBedsQueryError = ErrorType<unknown>;
/**
 * @summary List beds
 */
export declare function useListBeds<TData = Awaited<ReturnType<typeof listBeds>>, TError = ErrorType<unknown>>(params?: ListBedsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBeds>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create bed
 */
export declare const getCreateBedUrl: () => string;
export declare const createBed: (createBedBody: CreateBedBody, options?: RequestInit) => Promise<Bed>;
export declare const getCreateBedMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createBed>>, TError, {
        data: BodyType<CreateBedBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createBed>>, TError, {
    data: BodyType<CreateBedBody>;
}, TContext>;
export type CreateBedMutationResult = NonNullable<Awaited<ReturnType<typeof createBed>>>;
export type CreateBedMutationBody = BodyType<CreateBedBody>;
export type CreateBedMutationError = ErrorType<unknown>;
/**
 * @summary Create bed
 */
export declare const useCreateBed: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createBed>>, TError, {
        data: BodyType<CreateBedBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createBed>>, TError, {
    data: BodyType<CreateBedBody>;
}, TContext>;
/**
 * @summary List medicines
 */
export declare const getListMedicinesUrl: (params?: ListMedicinesParams) => string;
export declare const listMedicines: (params?: ListMedicinesParams, options?: RequestInit) => Promise<Medicine[]>;
export declare const getListMedicinesQueryKey: (params?: ListMedicinesParams) => readonly ["/api/pharmacy/medicines", ...ListMedicinesParams[]];
export declare const getListMedicinesQueryOptions: <TData = Awaited<ReturnType<typeof listMedicines>>, TError = ErrorType<unknown>>(params?: ListMedicinesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedicines>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMedicines>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMedicinesQueryResult = NonNullable<Awaited<ReturnType<typeof listMedicines>>>;
export type ListMedicinesQueryError = ErrorType<unknown>;
/**
 * @summary List medicines
 */
export declare function useListMedicines<TData = Awaited<ReturnType<typeof listMedicines>>, TError = ErrorType<unknown>>(params?: ListMedicinesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedicines>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Add medicine to pharmacy
 */
export declare const getCreateMedicineUrl: () => string;
export declare const createMedicine: (createMedicineBody: CreateMedicineBody, options?: RequestInit) => Promise<Medicine>;
export declare const getCreateMedicineMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedicine>>, TError, {
        data: BodyType<CreateMedicineBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createMedicine>>, TError, {
    data: BodyType<CreateMedicineBody>;
}, TContext>;
export type CreateMedicineMutationResult = NonNullable<Awaited<ReturnType<typeof createMedicine>>>;
export type CreateMedicineMutationBody = BodyType<CreateMedicineBody>;
export type CreateMedicineMutationError = ErrorType<unknown>;
/**
 * @summary Add medicine to pharmacy
 */
export declare const useCreateMedicine: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedicine>>, TError, {
        data: BodyType<CreateMedicineBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createMedicine>>, TError, {
    data: BodyType<CreateMedicineBody>;
}, TContext>;
/**
 * @summary Update medicine
 */
export declare const getUpdateMedicineUrl: (id: number) => string;
export declare const updateMedicine: (id: number, createMedicineBody: CreateMedicineBody, options?: RequestInit) => Promise<Medicine>;
export declare const getUpdateMedicineMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMedicine>>, TError, {
        id: number;
        data: BodyType<CreateMedicineBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMedicine>>, TError, {
    id: number;
    data: BodyType<CreateMedicineBody>;
}, TContext>;
export type UpdateMedicineMutationResult = NonNullable<Awaited<ReturnType<typeof updateMedicine>>>;
export type UpdateMedicineMutationBody = BodyType<CreateMedicineBody>;
export type UpdateMedicineMutationError = ErrorType<unknown>;
/**
 * @summary Update medicine
 */
export declare const useUpdateMedicine: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMedicine>>, TError, {
        id: number;
        data: BodyType<CreateMedicineBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMedicine>>, TError, {
    id: number;
    data: BodyType<CreateMedicineBody>;
}, TContext>;
/**
 * @summary List pharmacy sales/bills
 */
export declare const getListPharmacySalesUrl: (params?: ListPharmacySalesParams) => string;
export declare const listPharmacySales: (params?: ListPharmacySalesParams, options?: RequestInit) => Promise<PharmacySaleListResponse>;
export declare const getListPharmacySalesQueryKey: (params?: ListPharmacySalesParams) => readonly ["/api/pharmacy/sales", ...ListPharmacySalesParams[]];
export declare const getListPharmacySalesQueryOptions: <TData = Awaited<ReturnType<typeof listPharmacySales>>, TError = ErrorType<unknown>>(params?: ListPharmacySalesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPharmacySales>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPharmacySales>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPharmacySalesQueryResult = NonNullable<Awaited<ReturnType<typeof listPharmacySales>>>;
export type ListPharmacySalesQueryError = ErrorType<unknown>;
/**
 * @summary List pharmacy sales/bills
 */
export declare function useListPharmacySales<TData = Awaited<ReturnType<typeof listPharmacySales>>, TError = ErrorType<unknown>>(params?: ListPharmacySalesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPharmacySales>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create pharmacy sale
 */
export declare const getCreatePharmacySaleUrl: () => string;
export declare const createPharmacySale: (createPharmacySaleBody: CreatePharmacySaleBody, options?: RequestInit) => Promise<PharmacySale>;
export declare const getCreatePharmacySaleMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPharmacySale>>, TError, {
        data: BodyType<CreatePharmacySaleBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPharmacySale>>, TError, {
    data: BodyType<CreatePharmacySaleBody>;
}, TContext>;
export type CreatePharmacySaleMutationResult = NonNullable<Awaited<ReturnType<typeof createPharmacySale>>>;
export type CreatePharmacySaleMutationBody = BodyType<CreatePharmacySaleBody>;
export type CreatePharmacySaleMutationError = ErrorType<unknown>;
/**
 * @summary Create pharmacy sale
 */
export declare const useCreatePharmacySale: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPharmacySale>>, TError, {
        data: BodyType<CreatePharmacySaleBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPharmacySale>>, TError, {
    data: BodyType<CreatePharmacySaleBody>;
}, TContext>;
/**
 * @summary Low stock and expiry alerts
 */
export declare const getGetPharmacyStockSummaryUrl: () => string;
export declare const getPharmacyStockSummary: (options?: RequestInit) => Promise<PharmacyStockSummary>;
export declare const getGetPharmacyStockSummaryQueryKey: () => readonly ["/api/pharmacy/stock-summary"];
export declare const getGetPharmacyStockSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getPharmacyStockSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPharmacyStockSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPharmacyStockSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPharmacyStockSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getPharmacyStockSummary>>>;
export type GetPharmacyStockSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Low stock and expiry alerts
 */
export declare function useGetPharmacyStockSummary<TData = Awaited<ReturnType<typeof getPharmacyStockSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPharmacyStockSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List hospital inventory items
 */
export declare const getListInventoryItemsUrl: (params?: ListInventoryItemsParams) => string;
export declare const listInventoryItems: (params?: ListInventoryItemsParams, options?: RequestInit) => Promise<InventoryItem[]>;
export declare const getListInventoryItemsQueryKey: (params?: ListInventoryItemsParams) => readonly ["/api/inventory/items", ...ListInventoryItemsParams[]];
export declare const getListInventoryItemsQueryOptions: <TData = Awaited<ReturnType<typeof listInventoryItems>>, TError = ErrorType<unknown>>(params?: ListInventoryItemsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInventoryItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listInventoryItems>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListInventoryItemsQueryResult = NonNullable<Awaited<ReturnType<typeof listInventoryItems>>>;
export type ListInventoryItemsQueryError = ErrorType<unknown>;
/**
 * @summary List hospital inventory items
 */
export declare function useListInventoryItems<TData = Awaited<ReturnType<typeof listInventoryItems>>, TError = ErrorType<unknown>>(params?: ListInventoryItemsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInventoryItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Add inventory item
 */
export declare const getCreateInventoryItemUrl: () => string;
export declare const createInventoryItem: (createInventoryItemBody: CreateInventoryItemBody, options?: RequestInit) => Promise<InventoryItem>;
export declare const getCreateInventoryItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createInventoryItem>>, TError, {
        data: BodyType<CreateInventoryItemBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createInventoryItem>>, TError, {
    data: BodyType<CreateInventoryItemBody>;
}, TContext>;
export type CreateInventoryItemMutationResult = NonNullable<Awaited<ReturnType<typeof createInventoryItem>>>;
export type CreateInventoryItemMutationBody = BodyType<CreateInventoryItemBody>;
export type CreateInventoryItemMutationError = ErrorType<unknown>;
/**
 * @summary Add inventory item
 */
export declare const useCreateInventoryItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createInventoryItem>>, TError, {
        data: BodyType<CreateInventoryItemBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createInventoryItem>>, TError, {
    data: BodyType<CreateInventoryItemBody>;
}, TContext>;
/**
 * @summary Update inventory item
 */
export declare const getUpdateInventoryItemUrl: (id: number) => string;
export declare const updateInventoryItem: (id: number, createInventoryItemBody: CreateInventoryItemBody, options?: RequestInit) => Promise<InventoryItem>;
export declare const getUpdateInventoryItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateInventoryItem>>, TError, {
        id: number;
        data: BodyType<CreateInventoryItemBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateInventoryItem>>, TError, {
    id: number;
    data: BodyType<CreateInventoryItemBody>;
}, TContext>;
export type UpdateInventoryItemMutationResult = NonNullable<Awaited<ReturnType<typeof updateInventoryItem>>>;
export type UpdateInventoryItemMutationBody = BodyType<CreateInventoryItemBody>;
export type UpdateInventoryItemMutationError = ErrorType<unknown>;
/**
 * @summary Update inventory item
 */
export declare const useUpdateInventoryItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateInventoryItem>>, TError, {
        id: number;
        data: BodyType<CreateInventoryItemBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateInventoryItem>>, TError, {
    id: number;
    data: BodyType<CreateInventoryItemBody>;
}, TContext>;
/**
 * @summary Inventory summary with low stock alerts
 */
export declare const getGetInventorySummaryUrl: () => string;
export declare const getInventorySummary: (options?: RequestInit) => Promise<InventorySummary>;
export declare const getGetInventorySummaryQueryKey: () => readonly ["/api/inventory/summary"];
export declare const getGetInventorySummaryQueryOptions: <TData = Awaited<ReturnType<typeof getInventorySummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInventorySummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getInventorySummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetInventorySummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getInventorySummary>>>;
export type GetInventorySummaryQueryError = ErrorType<unknown>;
/**
 * @summary Inventory summary with low stock alerts
 */
export declare function useGetInventorySummary<TData = Awaited<ReturnType<typeof getInventorySummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInventorySummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List hospital invoices
 */
export declare const getListInvoicesUrl: (params?: ListInvoicesParams) => string;
export declare const listInvoices: (params?: ListInvoicesParams, options?: RequestInit) => Promise<InvoiceListResponse>;
export declare const getListInvoicesQueryKey: (params?: ListInvoicesParams) => readonly ["/api/billing/invoices", ...ListInvoicesParams[]];
export declare const getListInvoicesQueryOptions: <TData = Awaited<ReturnType<typeof listInvoices>>, TError = ErrorType<unknown>>(params?: ListInvoicesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInvoices>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listInvoices>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListInvoicesQueryResult = NonNullable<Awaited<ReturnType<typeof listInvoices>>>;
export type ListInvoicesQueryError = ErrorType<unknown>;
/**
 * @summary List hospital invoices
 */
export declare function useListInvoices<TData = Awaited<ReturnType<typeof listInvoices>>, TError = ErrorType<unknown>>(params?: ListInvoicesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInvoices>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create hospital invoice
 */
export declare const getCreateInvoiceUrl: () => string;
export declare const createInvoice: (createInvoiceBody: CreateInvoiceBody, options?: RequestInit) => Promise<Invoice>;
export declare const getCreateInvoiceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createInvoice>>, TError, {
        data: BodyType<CreateInvoiceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createInvoice>>, TError, {
    data: BodyType<CreateInvoiceBody>;
}, TContext>;
export type CreateInvoiceMutationResult = NonNullable<Awaited<ReturnType<typeof createInvoice>>>;
export type CreateInvoiceMutationBody = BodyType<CreateInvoiceBody>;
export type CreateInvoiceMutationError = ErrorType<unknown>;
/**
 * @summary Create hospital invoice
 */
export declare const useCreateInvoice: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createInvoice>>, TError, {
        data: BodyType<CreateInvoiceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createInvoice>>, TError, {
    data: BodyType<CreateInvoiceBody>;
}, TContext>;
/**
 * @summary Get invoice by ID
 */
export declare const getGetInvoiceUrl: (id: number) => string;
export declare const getInvoice: (id: number, options?: RequestInit) => Promise<Invoice>;
export declare const getGetInvoiceQueryKey: (id: number) => readonly [`/api/billing/invoices/${number}`];
export declare const getGetInvoiceQueryOptions: <TData = Awaited<ReturnType<typeof getInvoice>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInvoice>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getInvoice>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetInvoiceQueryResult = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
export type GetInvoiceQueryError = ErrorType<unknown>;
/**
 * @summary Get invoice by ID
 */
export declare function useGetInvoice<TData = Awaited<ReturnType<typeof getInvoice>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInvoice>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update invoice (record payment)
 */
export declare const getUpdateInvoiceUrl: (id: number) => string;
export declare const updateInvoice: (id: number, updateInvoiceBody: UpdateInvoiceBody, options?: RequestInit) => Promise<Invoice>;
export declare const getUpdateInvoiceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateInvoice>>, TError, {
        id: number;
        data: BodyType<UpdateInvoiceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateInvoice>>, TError, {
    id: number;
    data: BodyType<UpdateInvoiceBody>;
}, TContext>;
export type UpdateInvoiceMutationResult = NonNullable<Awaited<ReturnType<typeof updateInvoice>>>;
export type UpdateInvoiceMutationBody = BodyType<UpdateInvoiceBody>;
export type UpdateInvoiceMutationError = ErrorType<unknown>;
/**
 * @summary Update invoice (record payment)
 */
export declare const useUpdateInvoice: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateInvoice>>, TError, {
        id: number;
        data: BodyType<UpdateInvoiceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateInvoice>>, TError, {
    id: number;
    data: BodyType<UpdateInvoiceBody>;
}, TContext>;
/**
 * @summary Billing summary (today, month, outstanding)
 */
export declare const getGetBillingSummaryUrl: () => string;
export declare const getBillingSummary: (options?: RequestInit) => Promise<BillingSummary>;
export declare const getGetBillingSummaryQueryKey: () => readonly ["/api/billing/summary"];
export declare const getGetBillingSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getBillingSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBillingSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBillingSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBillingSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getBillingSummary>>>;
export type GetBillingSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Billing summary (today, month, outstanding)
 */
export declare function useGetBillingSummary<TData = Awaited<ReturnType<typeof getBillingSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBillingSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List Tally-compatible ledger groups
 */
export declare const getListLedgerGroupsUrl: () => string;
export declare const listLedgerGroups: (options?: RequestInit) => Promise<LedgerGroup[]>;
export declare const getListLedgerGroupsQueryKey: () => readonly ["/api/accounting/ledger-groups"];
export declare const getListLedgerGroupsQueryOptions: <TData = Awaited<ReturnType<typeof listLedgerGroups>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLedgerGroups>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLedgerGroups>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLedgerGroupsQueryResult = NonNullable<Awaited<ReturnType<typeof listLedgerGroups>>>;
export type ListLedgerGroupsQueryError = ErrorType<unknown>;
/**
 * @summary List Tally-compatible ledger groups
 */
export declare function useListLedgerGroups<TData = Awaited<ReturnType<typeof listLedgerGroups>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLedgerGroups>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create ledger group
 */
export declare const getCreateLedgerGroupUrl: () => string;
export declare const createLedgerGroup: (createLedgerGroupBody: CreateLedgerGroupBody, options?: RequestInit) => Promise<LedgerGroup>;
export declare const getCreateLedgerGroupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLedgerGroup>>, TError, {
        data: BodyType<CreateLedgerGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createLedgerGroup>>, TError, {
    data: BodyType<CreateLedgerGroupBody>;
}, TContext>;
export type CreateLedgerGroupMutationResult = NonNullable<Awaited<ReturnType<typeof createLedgerGroup>>>;
export type CreateLedgerGroupMutationBody = BodyType<CreateLedgerGroupBody>;
export type CreateLedgerGroupMutationError = ErrorType<unknown>;
/**
 * @summary Create ledger group
 */
export declare const useCreateLedgerGroup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLedgerGroup>>, TError, {
        data: BodyType<CreateLedgerGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createLedgerGroup>>, TError, {
    data: BodyType<CreateLedgerGroupBody>;
}, TContext>;
/**
 * @summary List ledgers
 */
export declare const getListLedgersUrl: (params?: ListLedgersParams) => string;
export declare const listLedgers: (params?: ListLedgersParams, options?: RequestInit) => Promise<Ledger[]>;
export declare const getListLedgersQueryKey: (params?: ListLedgersParams) => readonly ["/api/accounting/ledgers", ...ListLedgersParams[]];
export declare const getListLedgersQueryOptions: <TData = Awaited<ReturnType<typeof listLedgers>>, TError = ErrorType<unknown>>(params?: ListLedgersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLedgers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLedgers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLedgersQueryResult = NonNullable<Awaited<ReturnType<typeof listLedgers>>>;
export type ListLedgersQueryError = ErrorType<unknown>;
/**
 * @summary List ledgers
 */
export declare function useListLedgers<TData = Awaited<ReturnType<typeof listLedgers>>, TError = ErrorType<unknown>>(params?: ListLedgersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLedgers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create ledger
 */
export declare const getCreateLedgerUrl: () => string;
export declare const createLedger: (createLedgerBody: CreateLedgerBody, options?: RequestInit) => Promise<Ledger>;
export declare const getCreateLedgerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLedger>>, TError, {
        data: BodyType<CreateLedgerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createLedger>>, TError, {
    data: BodyType<CreateLedgerBody>;
}, TContext>;
export type CreateLedgerMutationResult = NonNullable<Awaited<ReturnType<typeof createLedger>>>;
export type CreateLedgerMutationBody = BodyType<CreateLedgerBody>;
export type CreateLedgerMutationError = ErrorType<unknown>;
/**
 * @summary Create ledger
 */
export declare const useCreateLedger: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLedger>>, TError, {
        data: BodyType<CreateLedgerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createLedger>>, TError, {
    data: BodyType<CreateLedgerBody>;
}, TContext>;
/**
 * @summary List accounting vouchers
 */
export declare const getListVouchersUrl: (params?: ListVouchersParams) => string;
export declare const listVouchers: (params?: ListVouchersParams, options?: RequestInit) => Promise<VoucherListResponse>;
export declare const getListVouchersQueryKey: (params?: ListVouchersParams) => readonly ["/api/accounting/vouchers", ...ListVouchersParams[]];
export declare const getListVouchersQueryOptions: <TData = Awaited<ReturnType<typeof listVouchers>>, TError = ErrorType<unknown>>(params?: ListVouchersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listVouchers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listVouchers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListVouchersQueryResult = NonNullable<Awaited<ReturnType<typeof listVouchers>>>;
export type ListVouchersQueryError = ErrorType<unknown>;
/**
 * @summary List accounting vouchers
 */
export declare function useListVouchers<TData = Awaited<ReturnType<typeof listVouchers>>, TError = ErrorType<unknown>>(params?: ListVouchersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listVouchers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create accounting voucher (Receipt/Payment/Journal/Sales/Purchase)
 */
export declare const getCreateVoucherUrl: () => string;
export declare const createVoucher: (createVoucherBody: CreateVoucherBody, options?: RequestInit) => Promise<Voucher>;
export declare const getCreateVoucherMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createVoucher>>, TError, {
        data: BodyType<CreateVoucherBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createVoucher>>, TError, {
    data: BodyType<CreateVoucherBody>;
}, TContext>;
export type CreateVoucherMutationResult = NonNullable<Awaited<ReturnType<typeof createVoucher>>>;
export type CreateVoucherMutationBody = BodyType<CreateVoucherBody>;
export type CreateVoucherMutationError = ErrorType<unknown>;
/**
 * @summary Create accounting voucher (Receipt/Payment/Journal/Sales/Purchase)
 */
export declare const useCreateVoucher: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createVoucher>>, TError, {
        data: BodyType<CreateVoucherBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createVoucher>>, TError, {
    data: BodyType<CreateVoucherBody>;
}, TContext>;
/**
 * @summary Export vouchers in Tally XML format
 */
export declare const getExportToTallyUrl: (params: ExportToTallyParams) => string;
export declare const exportToTally: (params: ExportToTallyParams, options?: RequestInit) => Promise<string | TallyExportResult>;
export declare const getExportToTallyQueryKey: (params?: ExportToTallyParams) => readonly ["/api/accounting/tally-export", ...ExportToTallyParams[]];
export declare const getExportToTallyQueryOptions: <TData = Awaited<ReturnType<typeof exportToTally>>, TError = ErrorType<unknown>>(params: ExportToTallyParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof exportToTally>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof exportToTally>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ExportToTallyQueryResult = NonNullable<Awaited<ReturnType<typeof exportToTally>>>;
export type ExportToTallyQueryError = ErrorType<unknown>;
/**
 * @summary Export vouchers in Tally XML format
 */
export declare function useExportToTally<TData = Awaited<ReturnType<typeof exportToTally>>, TError = ErrorType<unknown>>(params: ExportToTallyParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof exportToTally>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get trial balance
 */
export declare const getGetTrialBalanceUrl: (params?: GetTrialBalanceParams) => string;
export declare const getTrialBalance: (params?: GetTrialBalanceParams, options?: RequestInit) => Promise<TrialBalance>;
export declare const getGetTrialBalanceQueryKey: (params?: GetTrialBalanceParams) => readonly ["/api/accounting/trial-balance", ...GetTrialBalanceParams[]];
export declare const getGetTrialBalanceQueryOptions: <TData = Awaited<ReturnType<typeof getTrialBalance>>, TError = ErrorType<unknown>>(params?: GetTrialBalanceParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrialBalance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTrialBalance>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTrialBalanceQueryResult = NonNullable<Awaited<ReturnType<typeof getTrialBalance>>>;
export type GetTrialBalanceQueryError = ErrorType<unknown>;
/**
 * @summary Get trial balance
 */
export declare function useGetTrialBalance<TData = Awaited<ReturnType<typeof getTrialBalance>>, TError = ErrorType<unknown>>(params?: GetTrialBalanceParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTrialBalance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get P&L statement
 */
export declare const getGetProfitLossUrl: (params?: GetProfitLossParams) => string;
export declare const getProfitLoss: (params?: GetProfitLossParams, options?: RequestInit) => Promise<ProfitLoss>;
export declare const getGetProfitLossQueryKey: (params?: GetProfitLossParams) => readonly ["/api/accounting/profit-loss", ...GetProfitLossParams[]];
export declare const getGetProfitLossQueryOptions: <TData = Awaited<ReturnType<typeof getProfitLoss>>, TError = ErrorType<unknown>>(params?: GetProfitLossParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProfitLoss>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProfitLoss>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProfitLossQueryResult = NonNullable<Awaited<ReturnType<typeof getProfitLoss>>>;
export type GetProfitLossQueryError = ErrorType<unknown>;
/**
 * @summary Get P&L statement
 */
export declare function useGetProfitLoss<TData = Awaited<ReturnType<typeof getProfitLoss>>, TError = ErrorType<unknown>>(params?: GetProfitLossParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProfitLoss>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary OPD converted to IPD report
 */
export declare const getGetOpdToIpdReportUrl: (params?: GetOpdToIpdReportParams) => string;
export declare const getOpdToIpdReport: (params?: GetOpdToIpdReportParams, options?: RequestInit) => Promise<ConversionReportItem[]>;
export declare const getGetOpdToIpdReportQueryKey: (params?: GetOpdToIpdReportParams) => readonly ["/api/reports/opd-to-ipd", ...GetOpdToIpdReportParams[]];
export declare const getGetOpdToIpdReportQueryOptions: <TData = Awaited<ReturnType<typeof getOpdToIpdReport>>, TError = ErrorType<unknown>>(params?: GetOpdToIpdReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOpdToIpdReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOpdToIpdReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOpdToIpdReportQueryResult = NonNullable<Awaited<ReturnType<typeof getOpdToIpdReport>>>;
export type GetOpdToIpdReportQueryError = ErrorType<unknown>;
/**
 * @summary OPD converted to IPD report
 */
export declare function useGetOpdToIpdReport<TData = Awaited<ReturnType<typeof getOpdToIpdReport>>, TError = ErrorType<unknown>>(params?: GetOpdToIpdReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOpdToIpdReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Doctor-wise patient and revenue report
 */
export declare const getGetDoctorWiseReportUrl: (params?: GetDoctorWiseReportParams) => string;
export declare const getDoctorWiseReport: (params?: GetDoctorWiseReportParams, options?: RequestInit) => Promise<DoctorWiseReportItem[]>;
export declare const getGetDoctorWiseReportQueryKey: (params?: GetDoctorWiseReportParams) => readonly ["/api/reports/doctor-wise", ...GetDoctorWiseReportParams[]];
export declare const getGetDoctorWiseReportQueryOptions: <TData = Awaited<ReturnType<typeof getDoctorWiseReport>>, TError = ErrorType<unknown>>(params?: GetDoctorWiseReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDoctorWiseReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDoctorWiseReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDoctorWiseReportQueryResult = NonNullable<Awaited<ReturnType<typeof getDoctorWiseReport>>>;
export type GetDoctorWiseReportQueryError = ErrorType<unknown>;
/**
 * @summary Doctor-wise patient and revenue report
 */
export declare function useGetDoctorWiseReport<TData = Awaited<ReturnType<typeof getDoctorWiseReport>>, TError = ErrorType<unknown>>(params?: GetDoctorWiseReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDoctorWiseReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Financial report (revenue, collection, outstanding)
 */
export declare const getGetFinancialReportUrl: (params?: GetFinancialReportParams) => string;
export declare const getFinancialReport: (params?: GetFinancialReportParams, options?: RequestInit) => Promise<FinancialReport>;
export declare const getGetFinancialReportQueryKey: (params?: GetFinancialReportParams) => readonly ["/api/reports/financial", ...GetFinancialReportParams[]];
export declare const getGetFinancialReportQueryOptions: <TData = Awaited<ReturnType<typeof getFinancialReport>>, TError = ErrorType<unknown>>(params?: GetFinancialReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFinancialReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFinancialReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFinancialReportQueryResult = NonNullable<Awaited<ReturnType<typeof getFinancialReport>>>;
export type GetFinancialReportQueryError = ErrorType<unknown>;
/**
 * @summary Financial report (revenue, collection, outstanding)
 */
export declare function useGetFinancialReport<TData = Awaited<ReturnType<typeof getFinancialReport>>, TError = ErrorType<unknown>>(params?: GetFinancialReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFinancialReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Diagnosis-wise admission report
 */
export declare const getGetDiagnosisWiseReportUrl: (params?: GetDiagnosisWiseReportParams) => string;
export declare const getDiagnosisWiseReport: (params?: GetDiagnosisWiseReportParams, options?: RequestInit) => Promise<DiagnosisReportItem[]>;
export declare const getGetDiagnosisWiseReportQueryKey: (params?: GetDiagnosisWiseReportParams) => readonly ["/api/reports/diagnosis-wise", ...GetDiagnosisWiseReportParams[]];
export declare const getGetDiagnosisWiseReportQueryOptions: <TData = Awaited<ReturnType<typeof getDiagnosisWiseReport>>, TError = ErrorType<unknown>>(params?: GetDiagnosisWiseReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDiagnosisWiseReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDiagnosisWiseReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDiagnosisWiseReportQueryResult = NonNullable<Awaited<ReturnType<typeof getDiagnosisWiseReport>>>;
export type GetDiagnosisWiseReportQueryError = ErrorType<unknown>;
/**
 * @summary Diagnosis-wise admission report
 */
export declare function useGetDiagnosisWiseReport<TData = Awaited<ReturnType<typeof getDiagnosisWiseReport>>, TError = ErrorType<unknown>>(params?: GetDiagnosisWiseReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDiagnosisWiseReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map