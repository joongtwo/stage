// Copyright (c) 2022 Siemens

/**
 * @module js/mrlImportVendorService
 */
import _ from 'lodash';
import soaService from 'soa/kernel/soaService';
import dateTimeService from 'js/dateTimeService';
import messagingService from 'js/messagingService';
import appCtxService from 'js/appCtxService';

var exports = {};

var GTC_V1_0 = '1.0';
var GTC_V1_1 = '1.1';
var GTC_V2_0 = '2.0';
var DIN = '100';

export let updateFileSelection = function( fileData ) {
    return {
        vendorZipFileName: fileData.fileName,
        vendorValidZipFile: fileData.validFile,
        vendorZipFileFormData: fileData.formData
    };
};

export let updateVendorFormData = function( formData, key, value ) {
    if ( formData ) {
        formData.append( key, value );
    }
};

export let showDisclaimer = function( disclaimerOfselectedVendor ) {
    messagingService.showInfo( disclaimerOfselectedVendor );
};

export let setUploadAndUnzipFileInProgressInfo = function( data, isUploadAndUnZipFileInProgress, uploadAndUnZipFileInProgress ) {
    var mrlProgressInfoText;
    if ( uploadAndUnZipFileInProgress && data.vendorFileData && data.vendorFileData.vendorZipFileName ) {
        mrlProgressInfoText = data.i18n.mrlUnZipFileInProgress.replace( '{0}', data.vendorFileData.vendorZipFileName );
    }

    const newIsUploadAndUnZipFileInProgress = _.clone( isUploadAndUnZipFileInProgress );
    newIsUploadAndUnZipFileInProgress.dbValue = uploadAndUnZipFileInProgress;
    return {
        isUploadAndUnZipFileInProgress: newIsUploadAndUnZipFileInProgress,
        mrlProgressInfoText: mrlProgressInfoText
    };
};

export let resetImportVendorHierarchyFlags = function( data ) {
    const newData = _.clone( data );
    newData.isImportVendorHierarchyCompleted.dbValue = false;

    return {
        isImportVendorHierarchyCompleted: newData.isImportVendorHierarchyCompleted
    };
};

export let resetImportVendorProductsFlags = function( data ) {
    const newData = _.clone( data );
    newData.isImportVendorProductsCompleted.dbValue = false;
    newData.isMapVendorProductsCompleted.dbValue = false;
    newData.isImport3DModelsCompleted.dbValue = false;

    return {
        isImportVendorProductsCompleted: newData.isImportVendorProductsCompleted,
        isMapVendorProductsCompleted: newData.isMapVendorProductsCompleted,
        isImport3DModelsCompleted: newData.isImport3DModelsCompleted
    };
};

export let setImportVendorHierarchyInProgressInfo = function( data, isImportVendorHierarchyInProgress, importVendorHierarchyInProgress, selectedVendorName ) {
    var mrlProgressInfoText = data.i18n.mrlImportVendorHierarchyInProgress.replace( '{0}', selectedVendorName );
    var mrlImportVendorSummary = data.i18n.mrlImportVendorHierarchySummary;

    const newIsImportVendorHierarchyInProgress = _.clone( isImportVendorHierarchyInProgress );
    newIsImportVendorHierarchyInProgress.dbValue = importVendorHierarchyInProgress;

    return {
        isImportVendorHierarchyInProgress: newIsImportVendorHierarchyInProgress,
        mrlProgressInfoText: mrlProgressInfoText,
        mrlImportVendorSummary: mrlImportVendorSummary
    };
};

export let setImportVendorProductsInProgressInfo = function( data, isImportVendorProductsInProgress, importVendorProductsInProgress, selectedVendorName ) {
    var mrlProgressInfoText = data.i18n.mrlImportVendorDataInProgress.replace( '{0}', selectedVendorName );
    var mrlImportVendorSummary = data.i18n.mrlImportVendorDataSummary;

    const newIsImportVendorProductsInProgress = _.clone( isImportVendorProductsInProgress );
    newIsImportVendorProductsInProgress.dbValue = importVendorProductsInProgress;

    return {
        isImportVendorProductsInProgress: newIsImportVendorProductsInProgress,
        mrlProgressInfoText: mrlProgressInfoText,
        mrlImportVendorSummary: mrlImportVendorSummary
    };
};

export let setImportVendorHierarchyCompletedInfo = function( data, isImportVendorHierarchyCompleted, isImportVendorHierarchySucceed, selectedVendor ) {
    const newData = _.clone( data );
    newData.isImportVendorHierarchyCompleted.dbValue = isImportVendorHierarchySucceed;

    var mrlImportVendorFeedbackText;
    var vendorName = selectedVendor.props.vendorName.uiValue;

    newData.vendorName.uiValue = vendorName;

    if ( isImportVendorHierarchySucceed ) {
        mrlImportVendorFeedbackText = newData.i18n.mrlImportVendorHierarchySuccessFul.replace( '{0}', vendorName );
    } else {
        mrlImportVendorFeedbackText = newData.i18n.mrlImportVendorHierarchyFailed.replace( '{0}', vendorName );
    }

    return {
        isImportVendorHierarchyCompleted: newData.isImportVendorHierarchyCompleted,
        mrlImportVendorFeedbackText: mrlImportVendorFeedbackText,
        vendorName: newData.vendorName
    };
};

export let setImportVendorProductsCompletedInfo = function( data, isImportVendorProductsCompleted, isImportVendorProductsSucceed, selectedVendor ) {
    const newData = _.clone( data );
    newData.isImportVendorProductsCompleted.dbValue = isImportVendorProductsSucceed;

    var mrlImportVendorFeedbackText;
    var vendorName = selectedVendor.props.vendorName.uiValue;

    newData.vendorName.uiValue = vendorName;
    var vendorId = selectedVendor.props.gtcPackageId.uiValue;
    var numberOfProductsInVendor = selectedVendor.props.vendorProductCount.uiValue;
    newData.vendorId.uiValue = vendorId;
    newData.numberOfProductsInVendor.uiValue = numberOfProductsInVendor;
    newData.numberOfProductsImported.uiValue = newData.vendorProductsSuccessfullyImported.toString() + '/' + numberOfProductsInVendor;

    if ( isImportVendorProductsSucceed ) {
        mrlImportVendorFeedbackText = newData.i18n.mrlImportVendorDataSuccessFul.replace( '{0}', vendorName );
    } else {
        mrlImportVendorFeedbackText = newData.i18n.mrlImportVendorDataFailed.replace( '{0}', vendorName );
    }

    return {
        isImportVendorProductsCompleted: newData.isImportVendorProductsCompleted,
        mrlImportVendorFeedbackText: mrlImportVendorFeedbackText,
        vendorId: newData.vendorId,
        vendorName: newData.vendorName,
        numberOfProductsInVendor: newData.numberOfProductsInVendor,
        numberOfProductsImported: newData.numberOfProductsImported
    };
};

export let setMapVendorProductsInProgressInfo = function( data, isMapVendorProductsInProgress, mapVendorProductsInProgress, selectedVendorName ) {
    var mrlProgressInfoText = data.i18n.mrlMapVendorProductsInProgress.replace( '{0}', selectedVendorName );

    const newIsMapVendorProductsInProgress = _.clone( isMapVendorProductsInProgress );
    newIsMapVendorProductsInProgress.dbValue = mapVendorProductsInProgress;

    return {
        isMapVendorProductsInProgress: newIsMapVendorProductsInProgress,
        mrlProgressInfoText: mrlProgressInfoText
    };
};

export let setMapVendorProductsCompletedInfo = function( data, isMapVendorProductsCompleted, isMapVendorProductsSucceed ) {
    const newData = _.clone( data );
    newData.isMapVendorProductsCompleted.dbValue = isMapVendorProductsSucceed;

    if ( newData.mapVendorProductsInfo ) {
        newData.numberOfMappedProducts.uiValue = newData.mapVendorProductsInfo.successCount.toString() + '/' + newData.mapVendorProductsInfo.totalCount.toString();
    }

    return {
        isMapVendorProductsCompleted: newData.isMapVendorProductsCompleted,
        numberOfMappedProducts: newData.numberOfMappedProducts
    };
};

export let setImport3DModelsInProgressInfo = function( data, isImport3DModelsInProgress, import3DModelsInProgress, selectedVendorName ) {
    var mrlProgressInfoText = data.i18n.mrlImport3DModelsInProgress.replace( '{0}', selectedVendorName );

    const newIsImport3DModelsInProgress = _.clone( isImport3DModelsInProgress );
    newIsImport3DModelsInProgress.dbValue = import3DModelsInProgress;

    return {
        isImport3DModelsInProgress: newIsImport3DModelsInProgress,
        mrlProgressInfoText: mrlProgressInfoText
    };
};

export let setImport3DModelsCompletedInfo = function( data, isImport3DModelsCompleted, isImport3DModelsSucceed ) {
    const newData = _.clone( data );
    newData.isImport3DModelsCompleted.dbValue = isImport3DModelsSucceed;

    if ( newData.import3DModelsInfo ) {
        newData.numberOfProductsImported3DModels.uiValue = newData.import3DModelsInfo.successCount.toString() + '/' + newData.import3DModelsInfo.totalCount.toString();
    }

    return {
        isImport3DModelsCompleted: newData.isImport3DModelsCompleted,
        numberOfProductsImported3DModels: newData.numberOfProductsImported3DModels
    };
};

export let getVendors = function( response, sortCriteria, catalogTypeFilter ) {
    var vendors = [];
    var vendorCatalogs = response.catalogInfo;
    var gtcVendorProductCountMap;
    if ( vendorCatalogs && vendorCatalogs.length > 0 ) {
        var gtcVendorClassIds = [];
        var gtcVendorCatalogRootDirs = [];
        _.forEach( vendorCatalogs, function( catalog ) {
            if ( catalog.gtcVersion !== DIN ) {
                gtcVendorClassIds.push( catalog.vendorCatalogRootClassId );
                gtcVendorCatalogRootDirs.push( catalog.vendorCatalogRootDir );
            }
        } );

        if ( gtcVendorClassIds.length > 0 ) {
            // Additional SOA call need for getting product counts for GTC vendors
            // For DIN vendors currently we are getting product count using 'disclaimerText'
            var serviceName = 'Internal-Manufacturing-2014-12-ResourceManagement';
            var operationName = 'getStepP21FileCounts2';
            var request = {
                classIds: gtcVendorClassIds,
                catalogRootDirectories: gtcVendorCatalogRootDirs
            };

            return soaService.post( serviceName, operationName, request )
                .then( function( response ) {
                    gtcVendorProductCountMap = response.countMap;
                    vendors = getVendorsWithProductCount( vendorCatalogs, catalogTypeFilter, gtcVendorProductCountMap, sortCriteria, gtcVendorClassIds );
                    return vendors;
                } );
        }

        //It means there are only DIN vendors are available
        vendors = getVendorsWithProductCount( vendorCatalogs, catalogTypeFilter, gtcVendorProductCountMap, sortCriteria, gtcVendorClassIds );
        return vendors;
    }
};

//Sort vendors by given sortCriteria.
//Default sort criteria is newest at top by creation date.
function sortVendors( vendors, sortCriteria ) {
    if ( sortCriteria && sortCriteria.length > 0 ) {
        let criteria = sortCriteria[0];
        let sortDirection = criteria.sortDirection;
        let sortColName = criteria.fieldName;

        if ( sortDirection === 'ASC' ) {
            vendors.sort( function( vendor1, vendor2 ) {
                if ( vendor1.props[sortColName].value <= vendor2.props[sortColName].value ) {
                    return -1;
                }
                return 1;
            } );
        } else if ( sortDirection === 'DESC' ) {
            vendors.sort( function( vendor1, vendor2 ) {
                if ( vendor1.props[sortColName].value >= vendor2.props[sortColName].value ) {
                    return -1;
                }
                return 1;
            } );
        }
    }

    return vendors;
}

//Get vendors with product count
function getVendorsWithProductCount( vendorCatalogs, catalogTypeFilter, gtcVendorProductCountMap, sortCriteria, gtcVendorClassIds ) {
    var vendors = [];
    var noOfVendors = 0;
    var packageType;
    var productCount = 0;
    _.forEach( vendorCatalogs, function( catalog ) {
        var vendorCreationDateInAWFormat;

        if ( catalog.gtcVersion === DIN ) {
            //For DIN vendors server returns date in format 'YYYY-MM-DDThh:mm:ss±hh:mm'
            var jsDate = new Date( catalog.gtcPackageCreationDate );
            vendorCreationDateInAWFormat = dateTimeService.formatDate( jsDate, dateTimeService.getSessionDateTimeFormat() );
            //Read product count from disclaimer text field for DIN vendors.
            productCount = parseInt( catalog.disclaimerText, 10 );
        } else if ( gtcVendorProductCountMap ) {
            vendorCreationDateInAWFormat = convertGTCVendorCreationDateIntoAWFormat( catalog.gtcPackageCreationDate );
            if( gtcVendorClassIds.length === 1 ) {
                //If there is only one GTC class id then get product count from map using class id
                productCount = gtcVendorProductCountMap[catalog.vendorCatalogRootClassId];
            } else {
                //If there are more than one GTC class ids then get product count from map using "catalog directory + class id"
                productCount = gtcVendorProductCountMap[catalog.vendorCatalogRootDir + catalog.vendorCatalogRootClassId];
            }
        }

        if ( catalogTypeFilter === 1 || productCount > 0 ) {
            noOfVendors++;

            switch ( catalog.gtcVersion ) {
                case GTC_V1_0:
                    packageType = 'GTC V1.0';
                    break;
                case GTC_V1_1:
                    packageType = 'GTC V1.1';
                    break;
                case GTC_V2_0:
                    packageType = 'GTC V2.0';
                    break;
                case DIN:
                    packageType = 'DIN';
                    break;
                default:
                    packageType = 'GTC V2.0';
            }

            var vendor = {
                uid: noOfVendors,
                id: noOfVendors,
                type: 'Catalog',
                props: {
                    vendorName: {
                        type: 'STRING',
                        uiValue: catalog.vendorName,
                        value: catalog.vendorName,
                        propertyName: 'vendorName'
                    },
                    vendorPackageId: {
                        type: 'STRING',
                        uiValue: catalog.gtcPackageId,
                        value: catalog.gtcPackageId,
                        propertyName: 'vendorPackageId'
                    },
                    vendorCatalogDescription: {
                        type: 'STRING',
                        uiValue: catalog.vendorCatalogDescription,
                        value: catalog.vendorCatalogDescription,
                        propertyName: 'vendorCatalogDescription'
                    },
                    vendorCatalogVersion: {
                        type: 'STRING',
                        uiValue: catalog.vendorCatalogVersion,
                        value: catalog.vendorCatalogVersion,
                        propertyName: 'vendorCatalogVersion'
                    },
                    gtcPackageCreationDate: {
                        type: 'DATE',
                        uiValue: vendorCreationDateInAWFormat,
                        value: catalog.gtcPackageCreationDate,
                        propertyName: 'gtcPackageCreationDate'
                    },
                    vendorProductCount: {
                        type: 'INTEGER',
                        uiValue: productCount.toString(),
                        value: productCount,
                        propertyName: 'vendorProductCount'
                    },
                    vendorPackageType: {
                        type: 'STRING',
                        uiValue: packageType,
                        value: packageType,
                        propertyName: 'vendorPackageType'
                    },
                    vendorCatalogRootClassId: {
                        type: 'STRING',
                        uiValue: catalog.vendorCatalogRootClassId,
                        value: catalog.vendorCatalogRootClassId,
                        propertyName: 'vendorCatalogRootClassId'
                    },
                    vendorCatalogRootDir: {
                        type: 'STRING',
                        uiValue: catalog.vendorCatalogRootDir,
                        value: catalog.vendorCatalogRootDir,
                        propertyName: 'vendorCatalogRootDir'
                    },
                    disclaimerText: {
                        type: 'STRING',
                        uiValue: catalog.disclaimerText,
                        value: catalog.disclaimerText,
                        propertyName: 'disclaimerText'
                    },
                    gtcPackageId: {
                        type: 'STRING',
                        uiValue: catalog.gtcPackageId,
                        value: catalog.gtcPackageId,
                        propertyName: 'gtcPackageId'
                    }
                }
            };

            vendors.push( vendor );
        }
    } );

    if ( vendors.length > 1 ) {
        return sortVendors( vendors, sortCriteria );
    }

    return vendors;
}

//It converts GTC vendor creation date in AW session format.
function convertGTCVendorCreationDateIntoAWFormat( vendorCreationDate ) {
    //Server vendor creation date is in format - 'yyyyMMdd_HHmmss'
    var year = vendorCreationDate.substring( 0, 4 );
    var month = vendorCreationDate.substring( 4, 6 );
    var date = vendorCreationDate.substring( 6, 8 );
    var hours = vendorCreationDate.substring( 9, 11 );
    var minutes = vendorCreationDate.substring( 11, 13 );
    var seconds = vendorCreationDate.substring( 13, 15 );

    //create date string in format 'yyyy-MM-ddTHH:mm:ss'
    var dateStr = year + '-' + month + '-' + date + 'T' + hours + ':' + minutes + ':' + seconds;
    var jsDate = new Date( dateStr );

    return dateTimeService.formatDate( jsDate, dateTimeService.getSessionDateTimeFormat() );
}

export let getSelectedItemType = function( viewModel ) {
    let data = { ...viewModel.getData() };
    var selectedItemType;
    if ( data.eventData.selectedUids.length ) {
        selectedItemType = data.eventData.selectedObjects[0].object.props.type_name.dbValues[0];
    } else {
        selectedItemType = 'Mfg0MENCTool';
    }
    return selectedItemType;
};

export default exports = {
    updateFileSelection,
    updateVendorFormData,
    getVendors,
    showDisclaimer,
    resetImportVendorHierarchyFlags,
    resetImportVendorProductsFlags,
    setImportVendorHierarchyCompletedInfo,
    setImportVendorProductsCompletedInfo,
    setUploadAndUnzipFileInProgressInfo,
    setImportVendorHierarchyInProgressInfo,
    setImportVendorProductsInProgressInfo,
    getSelectedItemType,
    setMapVendorProductsInProgressInfo,
    setMapVendorProductsCompletedInfo,
    setImport3DModelsInProgressInfo,
    setImport3DModelsCompletedInfo
};
