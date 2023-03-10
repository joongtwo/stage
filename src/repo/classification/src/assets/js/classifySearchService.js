/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This is a utility to format the response for the classification hierarchy to be compatible with the generic
 * property widgets.
 *
 * @module js/classifySearchService
 */
import messagingService from 'js/messagingService';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import searchFilterSvc from 'js/aw.searchFilter.service';
import awSearchService from 'js/awSearchService';
import filterPanelUtils_ from 'js/filterPanelUtils';
import filterPanelService_ from 'js/filterPanelService';
import classifyUtils from 'js/classifyUtils';
import TcServerVersion from 'js/TcServerVersion';
import localeService from 'js/localeService';
import classifyService from 'js/classifyService';
import dateTimeService from 'js/dateTimeService';
import searchHighlightingService from 'js/Awp0SearchHighlightingService';
import searchSimilarService from 'js/searchSimilarService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import localStrg from 'js/localStorage';
import iconSvc from 'js/iconService';

var exports = {};

const classificationSubLocations = [ 'showClassification', 'tcmaClassificationSearch', 'tcmaGlobalSearch' ];


/**
 * Returns a single clubbed message with newline as a delimiter provided an array of string messages
 *
 * @function getInfoMessages
 *
 * @return {String} Concatenated string representing multiple info messages separated by newline character
 */
export let getInfoMessages = function( data ) {
    let listOfMessages = '';
    if( data.additionalSearchInfoMap && data.additionalSearchInfoMap.additionalInfoMessages ) {
        listOfMessages = data.additionalSearchInfoMap.additionalInfoMessages;
        if( Array.isArray( listOfMessages ) ) {
            return listOfMessages.join( '\n' );
        }
    }
    return listOfMessages;
};


export let toggleBulkFiltering = function( data ) {
    return function() {
        //  var ctx = appCtxService.getCtx('clsLocation');
        appCtxService.ctx.clsLocation.savedFilters.autoUpdateEnabled = data.autoUpdateEnabled.dbValue;
        //  appCtxService.updateCtx( 'clsLocation', ctx );

        if( appCtxService.ctx.clsLocation.isBulkFilterMapDirty ) {
            eventBus.publish( 'propertiesPanel.applyAll' );
        }
    };
};

export let resetScopeForFilterPanel = function( data ) {
    var ctx = appCtxService.getCtx( 'clsLocation' );
    if ( ctx ) {
        if ( ctx.savedFilters ) {
            data.autoUpdateEnabled.dbValue = ctx.savedFilters.autoUpdateEnabled;
            data.bulkFiltersMap = ctx.savedFilters.filters;
        } else {
            ctx.savedFilters = {
                autoUpdateEnabled : true,
                filters: {}
            };
            data.autoUpdateEnabled.dbValue = ctx.savedFilters.autoUpdateEnabled;
            appCtxService.updateCtx( 'clsLocation', ctx );
        }
    }
    if( typeof data.autoUpdateEnabled.propApi !== 'object' ) {
        data.autoUpdateEnabled.propApi = {};
    }
};


export let viewerChanged = function( ctx ) {
    searchSimilarService.setSearchSimilarMode();

    if ( ctx !== undefined ) {
        if ( ctx.tableSummaryDataProviderName ) {
            eventBus.publish( ctx.tableSummaryDataProviderName + '.updateClassBreadCrumb' );
        }
    } else if ( !appCtxService.ctx.SearchSimilarActive ) {
        eventBus.publish( 'load.listView' );
    }
};

/**
 * Converts atrributes into filter compatible format
 * Need to prepare filterMap structure
 * @param attributes array of attributes
 */
export let formatAttrForFilterCompatibility = function( attributes ) {
    var filterCategoriesProps = {};

    for ( var i = 0; i < attributes.length; i++ ) {
        var categoryInternalName = classifyService.getFilterCompatibleKey( attributes[i].propertyId );

        var appliedFilters = [];
        var categoryFilterValues = {};
        categoryFilterValues.colorValue = '';
        categoryFilterValues.count = '';

        //If it's a date filter
        if ( attributes[i].attr.vmps[0].type === 'DATE' || attributes[i].attr.vmps[0].type === 'DATEARRAY' ) {
            var startValue = attributes[i].attr.daterange.startDate.dateApi.dateObject;
            var endValue = attributes[i].attr.daterange.endDate.dateApi.dateObject;

            var internalName = filterPanelUtils_.getDateRangeString( startValue, endValue );
            var internalFilter = filterPanelUtils_.getDateRangeFilter( internalName.substring( 12, internalName.length ) );
            internalFilter.internalName = internalName;
            internalFilter.name = searchFilterSvc.getBreadCrumbDisplayValue( [ internalFilter ], internalName );
            internalFilter.isUserInput = true;
            appliedFilters.push( internalFilter );

            filterCategoriesProps[categoryInternalName] = {
                appliedFilters: appliedFilters,
                categoryInfo: {
                    displayName: attributes[i].propertyName,
                    internalName: categoryInternalName
                }
            };
        } else if ( attributes[i].attr.vmps[0].type === 'STRING' || attributes[i].attr.vmps[0].type === 'STRINGARRAY' ) {
            //If it's a string filter
            categoryFilterValues.endDateValue = '';
            categoryFilterValues.endNumericValue = '';
            categoryFilterValues.searchFilterType = 'StringFilter';
            categoryFilterValues.selected = false;
            categoryFilterValues.startDateValue = '';
            categoryFilterValues.startEndRange = '';
            categoryFilterValues.startNumericValue = 0;
            categoryFilterValues.stringDisplayValue = '';
        } else if ( attributes[i].attr.vmps[0].type === 'INTEGER' || attributes[i].attr.vmps[0].type === 'INTEGERARRAY' || attributes[i].attr.vmps[0].type === 'DOUBLE' || attributes[i].attr.vmps[0].type === 'DOUBLEARRAY' ) {
            // If it's a numeric filter - Integer

            var startRange = parseFloat( attributes[i].attr.numericRange.startValue.dbValue );
            if ( isNaN( startRange ) ) {
                startRange = undefined;
            }
            var endRange = parseFloat( attributes[i].attr.numericRange.endValue.dbValue );
            if ( isNaN( endRange ) ) {
                endRange = undefined;
            }
            if ( filterPanelUtils_.checkIfValidRange( attributes[i], startRange, endRange ) ) {
                var internalName = filterPanelUtils_.getNumericRangeString( startRange, endRange );
                var internalFilter = filterPanelUtils_.getNumericRangeFilter( internalName.substring( 14, internalName.length ) );
                internalFilter.internalName = internalName;
                internalFilter.name = searchFilterSvc.getBreadCrumbDisplayValue( [ internalFilter ], internalName );
                internalFilter.isUserInput = true;
                appliedFilters.push( internalFilter );
                filterCategoriesProps[categoryInternalName] = {
                    appliedFilters: appliedFilters,
                    categoryInfo: {
                        displayName: attributes[i].propertyName,
                        internalName: categoryInternalName
                    }
                };
            }
        }

        if ( attributes[i].values[0].displayValue ) {
            if ( attributes[i].attr.attrDefn.isLOV ) {
                categoryFilterValues.internalName = attributes[i].attr.vmps[0].uiValue;
                categoryFilterValues.stringValue = attributes[i].attr.vmps[0].uiValue;
                categoryFilterValues.name = attributes[i].attr.vmps[0].uiValue;
                appliedFilters.push( categoryFilterValues );
            } else {
                categoryFilterValues.internalName = attributes[i].values[0].displayValue;
                categoryFilterValues.stringValue = attributes[i].values[0].displayValue;
                categoryFilterValues.name = attributes[i].values[0].displayValue;
                appliedFilters.push( categoryFilterValues );
            }
            filterCategoriesProps[categoryInternalName] = {
                appliedFilters: appliedFilters,
                categoryInfo: {
                    displayName: attributes[i].propertyName,
                    internalName: categoryInternalName
                }
            };
        }
    }

    return filterCategoriesProps;
};

/**
 * Following method would be called when panel is getting closed. It allows to browse
 * through VNCs or braedcrumb if panel is in closed state.
 * @param {*} ctx application context
 */
export let setPanelIsClosedOnCtx = function() {
    appCtxService.ctx.clsLocation.panelIsClosed = true;

    resetStandAlone();
};

/**
 * When a user select "Classification Object" in classification location and then exits to home or
 * folder location "ctx.clsLocation.showStandalone" must be set to false.
 * @param {*} ctx application context
 */
let resetStandAlone = function() {
    var locationContext = appCtxService.getCtx( 'locationContext' );
    var clsLocation = appCtxService.getCtx( 'clsLocation' );
    if ( !locationContext || !classificationSubLocations.includes( locationContext[ 'ActiveWorkspace:SubLocation' ] ) && clsLocation ) {
        clsLocation.breadcrumbs = null;
        clsLocation.datasetFilesOutput = null;
        clsLocation.imageURLs = null;
        clsLocation.parents = null;
        clsLocation.selectedClass = null;
        clsLocation.selectedNode = null;
        clsLocation.selectedTreeNode = null;
        clsLocation.prevSelectedClass = null;

        clsLocation.showStandalone = false;
        appCtxService.updateCtx( 'clsLocation', clsLocation );
    }
};

/**
 *
 * @param {*} dat
 * @param {*} ctx
 */
export let searchClassOrFilters = function( data, ctx ) {
    if ( data.tableSummaryDataProviderName === 'getClassTableSummary' ) {
        //tree node is being selected, lets do class search
        ctx.clsLocation.startClassSearch = true;
        ctx.clsLocation.isFiltersVisible = true;
        ctx.clsLocation.isVncVisible = false;
        ctx.clsLocation.showParentVnc = data.eventData && data.eventData.parent ? data.eventData.parent : false;
        ctx.clsLocation.prevSelectedClass = ctx.clsLocation.selectedTreeNode;
        eventBus.publish( 'primaryWorkarea.reset' );
        ctx.clsLocation.isNavigating = true;
    } else {
        // Properties or Filters
        if ( !ctx.clsLocation.isFiltersVisible ) {
            ctx.clsLocation.isFiltersVisible = true;
            ctx.clsLocation.propertiesSearch = true;
            var attributes = [];
            //Create ValuesMap, from data.attr_anno, then get the attributes from it
            var valuesMap = classifyUtils.getClsUtilValueMap( data, data.selectedClass.id, null, null, data.attr_anno );
            valuesMap = exports.mapAttributesWithProperties( valuesMap, data.attr_anno );

            //push the attribute contents
            attributes = valuesMap.properties;
            var filterCategoriesProps = {};

            filterCategoriesProps = exports.formatAttrForFilterCompatibility( attributes, data );
            data.filterCategoriesProps = filterCategoriesProps;

            appCtxService.ctx.clsLocation.isVncVisible = false;
            appCtxService.ctx.clsLocation.bulkFiltersMap = filterCategoriesProps;
            data.bulkFiltersMap = _.clone( filterCategoriesProps );
            appCtxService.ctx.clsLocation.prevSelectedClass = appCtxService.ctx.clsLocation.selectedTreeNode;
            appCtxService.ctx.clsLocation.isNavigating = true;
        } else {
            exports.copyBulkFiltersToCtx( data );
            ctx.clsLocation.prevSelectedClass = ctx.clsLocation.selectedTreeNode;
            ctx.clsLocation.isNavigating = true;
            ctx.clsLocation.propertiesSearch = false;
        }
    }
};

export let mapAttributesWithProperties = function( valuesMap, attr_anno ) {
    for ( var i = 0; i < valuesMap.properties.length; i++ ) {
        _.forEach( attr_anno, function( attr_anno_itr ) {
            if ( valuesMap.properties[i].propertyId === attr_anno_itr.id ) {
                valuesMap.properties[i].attr = attr_anno_itr;
            }
        } );
    }

    return valuesMap;
};

//TBD
/**
 * Function to reset image viewer. This is called after navigating away from classification location.
 */
export let resetImageViewer = function() {
    appCtxService.ctx.clsLocation.imageURLs = null;
};

/**
 * Following method resets the application context variables, this would get called only while launching the filter panel
 * @param {*} data Declarative view model
 * @param {*} ctx Application context
 */
export let resetScope = function( data, ctx ) {
    if( ctx === undefined ) {
        ctx = appCtxService.ctx.clsLocation;
    }
    if ( data && ctx && ( data !== undefined && ctx !== undefined ) ) {
        appCtxService.updateCtx( 'selected', undefined );
        appCtxService.updateCtx( 'mselected', undefined );
        if ( ctx.clsLocation ) {
            ctx.clsLocation.showParentVnc = undefined;
        }
        eventBus.publish( 'primaryWorkArea.reset' );

        eventBus.publish( 'dataProvider.selectionChangeEvent', {
            selected: ctx.selections,
            source: 'secondaryWorkArea',
            dataProviderName: 'listDataProvider'
        } );
        var temp = {};
        // ctx.clsLocation = ctx.clsLocation || {};
        appCtxService.registerCtx( 'clsLocation', temp );
        temp.tableSummaryDataProviderName = 'getClassTableSummary';
        data.tableSummaryDataProviderName = 'getClassTableSummary';
        classifyService.clearClassBreadCrumb( data );
        temp.isChildVNC = null;
        temp.isVNCaction = null;
        if ( temp.selectedTreeNode ) {
            temp.selectedNode = null;
            temp.selectedTreeNode = null;
        }
        temp.chartProvider = null;
        temp.panelIsClosed = false;
        temp.selectedClass = null;
        temp.prevSelectedClass = null;
        temp.isNavigating = true;
        temp.propertiesSearch = false;
        temp.isFiltersVisible = false;
        temp.expansionCounter = 0;
        ctx.clsLocation.isSelectedObjectStandAlone = false;
        data.bulkFiltersMap = {};
        // Resetting searchResponseInfo will also reset the data.categories
        ctx.searchResponseInfo = {};
        this.clearSearchIndividualCategory();
        temp.bulkFiltersMap = _.clone( data.bulkFiltersMap );

        temp.supportedReleaseForSort = classifyUtils.checkIfSupportedTcVersionForSort( TcServerVersion.majorVersion,
            TcServerVersion.minorVersion, TcServerVersion.qrmNumber );

        appCtxService.updateCtx( 'clsLocation', temp );
        return true;
    }
};

/**
 * Resets the hierarchy information that is used for showing the tree and corresponding VNC
 * @param {Object} data The declarative viewmodel data
 */
export let resetTreeHierarchy = function( data ) {
    data.fullHierarchy = {};
    data.currentLevel = data.fullHierarchy;

    appCtxService.registerCtx( 'clsLocation.treeHierarchy', data.currentLevel );
};

/**
 *
 * Get view model for image viewer gallery
 */
export let getClassImageViewModel = function() {
    eventBus.publish( 'classifySearch.ClassImage' );
};

/**
 * Refresh the image viewer gallery when different class is selected
 */
export let refreshViewerGallery = function( data ) {
    if ( data && data.viewerData && data.viewerData.fileData && data.viewerData.fileData.viewer && data.viewerData !== null ) {
        data.viewerData.fileData.viewer = null;
        data.viewerData = null;
    }
};

/**
 * Formats the classification class Image attachments so that they can be displayed in the UI.
 *
 * @param {Object} data - The view-model data object
 * @param {object} ctx - Application context
 */
export let formatImageAttachments = function( data, ctx ) {
    var imageURLs = [];
    var totalNoOfImages = 0;
    var index = 0;
    var viewDataArray = [];
    // update the viewer gallery
    var datasetFilesOutput = ctx.clsLocation && ctx.clsLocation.datasetFilesOutput;
    var imageIndex = 0;

    if ( datasetFilesOutput && datasetFilesOutput.length > 0 && datasetFilesOutput[0] ) {
        _.forEach( datasetFilesOutput, function( dsOutputArrElement ) {
            var hasMoreImage = false;
            if ( datasetFilesOutput.length > 1 ) {
                hasMoreImage = true;
            }

            if ( dsOutputArrElement.documentType === 'image' ) {
                var ticket = dsOutputArrElement.ticket;
                var isSupportedImgtype = false;
                //  getting correct viewer for various format of supported images and pdf
                if ( ticket && ticket.length > 28 ) {
                    var n = ticket.lastIndexOf( '.' );
                    var ticketExt = ticket.substring( n + 1 ).toUpperCase();
                    if ( [ 'GIF', 'JPG', 'JPEG', 'PNG', 'BMP' ].indexOf( ticketExt ) > -1 ) {
                        var viewer = 'Awp0ImageViewer';
                        isSupportedImgtype = true;
                    } else if ( ticketExt === 'PDF' ) {
                        viewer = 'Awp0PDFViewer';
                        isSupportedImgtype = true;
                    }
                }
                if ( isSupportedImgtype ) {
                    totalNoOfImages++;
                    var thumbnailUrl = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
                        fmsUtils.getFilenameFromTicket( ticket ) + '?ticket=' + ticket;
                    imageURLs.push( thumbnailUrl );

                    var viewerData = {
                        datasetData: {},
                        fileData: {
                            file: {
                                cellHeader1: fmsUtils.getFilenameFromTicket( ticket )
                            },
                            fileUrl: thumbnailUrl,
                            fmsTicket: ticket,
                            viewer: viewer
                        },
                        hasMoreDatasets: hasMoreImage,
                        imageIndex: imageIndex
                    };
                    viewDataArray.push( viewerData );
                    imageIndex++;
                    data.clsImgAvailable = true;
                }
            }
        } );
    } else {
        var imageIconUrl = iconSvc.getTypeIconFileUrl( 'typeClassificationElement48.svg' );
        ctx.clsLocation.defaultClassImage = imageIconUrl;
    }
    data.totalNoOfImages = totalNoOfImages;
    //Set initial image to be selected in ribbon
    if ( viewDataArray[index] ) {
        viewDataArray[index].selected = true;
    }
    if ( totalNoOfImages > 0 ) {
        exports.setImageTitle();
    }
    data.ribbonIncr = 0;
    data.viewerData = viewDataArray[index];
    data.index = index;
    data.viewDataArray = viewDataArray;
    ctx.clsLocation.imageURLs = imageURLs;
};

/**
 * Helper function to set image viewer title
 */
export let setImageTitle = function() {
    var label = { source: 'i18n/ClassificationPanelMessages', key: 'imageAttachments' };
    localeService.getLocalizedText( label.source, label.key ).then(
        function( localizedText ) {
            var classAttachmentLabel = localizedText;
            var ctx = appCtxService.ctx;
            ctx.clsLocation.imageAttachmentsCaption = ctx.clsLocation.breadcrumbs && ctx.clsLocation.breadcrumbs.length > 0 ? ctx.clsLocation.breadcrumbs[ctx.clsLocation.breadcrumbs.length - 1].displayName + ' ' + classAttachmentLabel : ctx.clsLocation.imageAttachmentsCaption;
        } );
};

/**
 * Display previous image if there are multiple images
 *
 * @param {Object} data - the viewmodel data object
 */
export let onPrevChevron = function( data ) {
    if ( data.ribbonIncr > 0 ) {
        data.ribbonIncr -= 1;
    }
};

/**
 * Display Next image if there are multiple images
 *
 * @param {Object} data - the viewmodel data object
 */
export let onNextChevron = function( data ) {
    if ( data.ribbonIncr < data.viewDataArray.length - 1 ) {
        data.ribbonIncr += 1;
    }
};

/**
 * Setting the viewer data to previous or next image details as per the user input
 *
 * @param {Object} data - the viewmodel data object
 */
export let showImageViewer = function( data ) {
    var viewerData = {

        datasetData: {},
        fileData: {
            file: {
                cellHeader1: data.viewDataArray[data.index].fileData.file.cellHeader1

            },
            fileUrl: data.viewDataArray[data.index].fileData.fileUrl,
            fmsTicket: data.viewDataArray[data.index].fileData.fmsTicket,

            viewer: data.viewDataArray[data.index].fileData.viewer
        },
        hasMoreDatasets: true,
        imageIndex: data.viewDataArray[data.index].imageIndex
    };

    data.viewerData = viewerData;
};

/**
 * Publishes event on selecting tree node
 */
export let backToVNCTab = function() {
    eventBus.publish( 'back.ToVNCTab' );
};

/**
 * 1) Search Similar use case with populated CLS_search_similar_wso_props_enabled preference (if block):- Perform the SOA call to get wso facets & re-perform the SOA call with updated filtermap.
 * 2) General use case (else block):- Perform the SOA call & return the value.
 *
 * @param {Object} searchInput - parameter for performSearchViewModel4
 * @param {Object} subPanelContext - subpanel context
 * @returns {Object} Returns the response of performSearchViewModel4
 */
export let loadListData = function( searchInput, subPanelContext ) {
    const tmpContext = { ...subPanelContext.searchState.value };

    if ( tmpContext && tmpContext.mruActive ) {
        tmpContext.mruActive = false;
        subPanelContext.searchState.update( tmpContext );
    }

    var searchSimilarCtx = appCtxService.getCtx( 'SearchSimilarActive' );

    if ( searchSimilarCtx  ) {
        var preferences = appCtxService.getCtx( 'preferences' );
        var searchSimilarPrefCtx = preferences.CLS_search_similar_wso_props_enabled;
        if ( searchSimilarPrefCtx && searchSimilarPrefCtx.length > 0 ) {
            var selectedItem = localStrg.get( 'SearchSimilarItem' );
            selectedItem = JSON.parse( selectedItem );

            var searchWsoInput = {
                maxToLoad: searchInput.maxToLoad,
                maxToReturn: searchInput.maxToLoad,
                providerName: searchInput.providerName,
                searchCriteria: {
                    searchString: selectedItem.cellHeader2
                },
                searchFilterFieldSortType: searchInput.searchFilterFieldSortType,
                searchFilterMap6: {},
                searchSortCriteria: searchInput.searchSortCriteria,
                cursor: searchInput.cursor
            };

            return soaService.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', {
                searchInput: searchWsoInput
            } ).then( function( response ) {
                if ( response.searchFilterMap6 ) {
                    for ( var i in appCtxService.ctx.preferences.CLS_search_similar_wso_props_enabled ) {
                        var key = appCtxService.ctx.preferences.CLS_search_similar_wso_props_enabled[i];
                        if ( response.searchFilterMap6[key] ) {
                            if ( response.searchFilterMap6[key][0].searchFilterType === 'DateFilter' ) {
                                var dateKey = key.substr( key.lastIndexOf( '.' ) + 1 );
                                if ( selectedItem.props[dateKey] && selectedItem.props[dateKey].dbValues && selectedItem.props[dateKey].dbValues[0] ) {
                                    var dateValue = selectedItem.props[dateKey].dbValues[0];
                                    if ( dateValue ) {
                                        response.searchFilterMap6[key][0].startDateValue = dateValue.substring( 0, dateValue.indexOf( 'T' ) ) + 'T' + '00:00:00' + dateValue.substring( 19 );
                                        response.searchFilterMap6[key][0].endDateValue = dateValue.substring( 0, dateValue.indexOf( 'T' ) ) + 'T' + '23:59:59' + dateValue.substring( 19 );
                                        response.searchFilterMap6[key][0].startEndRange = '';
                                        searchInput.searchFilterMap6[key] = [];
                                        searchInput.searchFilterMap6[key][0] = response.searchFilterMap6[key][0];
                                    }
                                }
                            } else {
                                searchInput.searchFilterMap6[key] = response.searchFilterMap6[key];
                            }
                        }
                    }
                }
                return soaService.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', {
                    searchInput: searchInput
                } ).then( function( finalResponse ) {
                    return finalResponse;
                } );
            } );
        }
    } else if ( searchInput.searchCriteria.searchString ) {
        //This check will ensure that the soa is only triggered for multiples of searchInput.maxToLoad.
        //This will also ensure that no unnecessary soa calls are made.
        if( searchInput.cursor.startIndex % searchInput.maxToLoad !== 0 ) {
            return;
        }

        return soaService.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', {
            searchInput: searchInput
        } ).then( function( response ) {
            //LCS-537413: When scrolling PWA we want the make sure the total objects displayed on
            //PWA is equal to totalFound and stop displaying duplicates objects
            var startIndex = response.cursor.startIndex;
            var totalLoaded = response.totalLoaded;
            var total = totalLoaded + startIndex;
            var totalFound = response.totalFound;

            if ( totalFound >= total ) {
                return AwPromiseService.instance.resolve( response );
            }

            return AwPromiseService.instance.defer().promise;
        } );
    }
    return AwPromiseService.instance.defer().promise;
};

export let loadTableData = function( columnConfigInput, saveColumnConfigData, searchInput ) {
    if ( searchInput.searchCriteria.searchString )  {
        let soaPath = 'Internal-AWS2-2019-06-Finder';
        let soaName = 'performSearchViewModel4';
        return soaService
            .postUnchecked( soaPath, soaName, {
                columnConfigInput: columnConfigInput,
                saveColumnConfigData: saveColumnConfigData,
                searchInput: searchInput,
                inflateProperties: true,
                noServiceData: false
            } )
            .then(
                function( response ) {
                    if( response.searchResultsJSON ) {
                        response.searchResults = JSON.parse( response.searchResultsJSON );
                        delete response.searchResultsJSON;
                    }

                    // Create view model objects
                    response.searchResults = response.searchResults && response.searchResults.objects ? response.searchResults.objects
                        .map( function( vmo ) {
                            return viewModelObjectService.createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                        } ) : [];

                    return response;
                } );
    }
};

/**
 * Get localized text
 * @param {Object} selectedClass selected Class
 * @return {String} Returns localized text
 */
let getNoResultsMsg = function( selectedClass ) {
    var label = appCtxService.ctx.sublocation.label;
    return AwPromiseService.instance.all( {
        uiMessages: localeService.getTextPromise( label.source )
    } ).then( function( localizedText ) {
        appCtxService.ctx.clsLocation.noSearchResultsFound = {
            isNull: false,
            type: 'STRING',
            uiValue: localizedText.uiMessages.noSearchResultsFound.format( selectedClass.displayName )
        };
    } );
};


/**
 * Loads MRU or selected class objects based on MRU button status
 * @param {Object} subPanelContext - sub-panel context
 */
export let loadMRUObjects = function( subPanelContext ) {
    const tmpContext = { ...subPanelContext.searchState.value };
    if ( !tmpContext.mruActive ) {
        tmpContext.mruActive = true;
    } else {
        tmpContext.mruActive = false;
        eventBus.publish( 'primaryWorkarea.reset' );
    }
    subPanelContext.searchState.update( tmpContext );
};

/**
 * Executes during launch of classification location
 * @param {*} ctx clsLocation application context
 */
export let clsLocationLaunched = function( ctx ) {
    if( ctx ) {
        ctx.clsLocationViewStatusToDefault = false;
    }
};


/**
 * getEmptyString
 * @return {String} Empty string ""
 */
export let getEmptyFilterMap = function() {
    return {};
};

export let getClsSearchCriteria = function( subPanelContext ) {
    /**
    *Altering the search criteria in case of search from sub-location
    * when a classification object is selected from the tree.
    */
    let tempClsState = { ...subPanelContext.value };
    let searchStr = tempClsState.criteria.searchString;

    if ( searchStr && searchStr !== '' && !searchStr.includes( 'Classification Class Id' ) && subPanelContext.selectedNode && subPanelContext.selectedNode.id ) {
        //Create a new search string for the sub-panel location search which includes
        tempClsState.criteria.searchString = searchStr + ' AND ' + '"Classification Class Id":' + '"' + subPanelContext.selectedNode.id + '"';
        return tempClsState.criteria;
    }

    //reset search criteria if incontext search is cleared
    if ( searchStr === '' && tempClsState.searchStringSecondary !== '' ) {
        tempClsState.criteria.searchString = '"Classification Class Id":' + '"' + subPanelContext.selectedNode.id + '"';
        return tempClsState.criteria;
    }

    return subPanelContext.value.criteria;
};

/**
 * Following method sets search criteria for facet search
 * @param {Object} category the current filter category
 * @return {String} in format for class search
 */
export let getClsSearchCriteriaForFacetSearch = function( category ) {
    var str;
    str = exports.getClsSearchCriteria();

    var categoryForFacetSearch;
    var facetSearchCriteria = '';
    var searchFilterType;
    if ( category && category.internalName ) {
        searchFilterType = category.type;
        categoryForFacetSearch = category.internalName;
    }

    if ( searchFilterType === classifyService.NUMERIC_FILTER_KEYWORD ) {
        facetSearchCriteria = exports.getFacetSearchCriteriaForNumericFilter( category );
    } else if ( searchFilterType === classifyService.DATE_FILTER_KEYWORD ) {
        facetSearchCriteria = exports.getFacetSearchCriteriaForDateFilter( category );
    } else if ( searchFilterType === classifyService.STRING_FILTER_KEYWORD ) {
        if ( category.filterBy && category.filterBy !== '' ) {
            facetSearchCriteria = category.filterBy;
        }
    }

    return {
        searchString: str.searchString,
        categoryForFacetSearch: categoryForFacetSearch,
        facetSearchString: facetSearchCriteria
    };
};

/**
 * @function getFacetSearchCriteriaForNumericFilter - method to get the facet search criteria to pass to facet search SOA input
 * @param { Object } category - the current filter category
 * @returns { String } numericRangeCriteria - the facet search criteria for NumericFilter
 */

export let getFacetSearchCriteriaForNumericFilter = function( category ) {
    var numericRangeCriteria = '';
    var startNumericValue;
    var endNumericValue;
    if ( category.numericrange && category.numericrange.startValue &&
        category.numericrange.startValue.dbValue !== undefined &&
        category.numericrange.startValue.dbValue !== null ) {
        startNumericValue = category.numericrange.startValue.dbValue;
    }
    if ( category.numericrange && category.numericrange.endValue &&
        category.numericrange.endValue.dbValue !== undefined &&
        category.numericrange.endValue.dbValue !== null ) {
        endNumericValue = category.numericrange.endValue.dbValue;
    }
    if ( startNumericValue && endNumericValue ) {
        numericRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + startNumericValue +
            classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
            classifyService.SPACE_KEYWORD + endNumericValue + classifyService.BRACKET_KEYWORDS[1];
    } else if ( startNumericValue ) {
        endNumericValue = classifyService.WILDCARD_KEYWORD;
        numericRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + startNumericValue +
            classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
            classifyService.SPACE_KEYWORD + endNumericValue + classifyService.BRACKET_KEYWORDS[1];
    } else if ( endNumericValue ) {
        startNumericValue = classifyService.WILDCARD_KEYWORD;
        numericRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + startNumericValue +
            classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
            classifyService.SPACE_KEYWORD + endNumericValue + classifyService.BRACKET_KEYWORDS[1];
    }
    return numericRangeCriteria;
};

/**
 * @function getFacetSearchCriteriaForDateFilter - method to get the facet search criteria to pass to facet search SOA input
 * @param { Object } category - the current filter category
 * @returns { String } dateRangeCriteria - the facet search criteria for DateFilter
 */

export let getFacetSearchCriteriaForDateFilter = function( category ) {
    var dateRangeCriteria = '';
    var startDateValue;
    var endDateValue;
    if ( category.daterange && category.daterange.startDate &&
        category.daterange.startDate.dbValue && category.daterange.startDate.dbValue > 0 ) {
        startDateValue = category.daterange.startDate.dbValue;
    }
    if ( category.daterange && category.daterange.endDate &&
        category.daterange.endDate.dbValue && category.daterange.endDate.dbValue > 0 ) {
        endDateValue = category.daterange.endDate.dbValue;
    }
    if ( startDateValue && endDateValue ) {
        dateRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + dateTimeService.formatUTC( new Date( startDateValue ) ).substring( 0, 10 ) +
            classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
            classifyService.SPACE_KEYWORD + dateTimeService.formatUTC( new Date( endDateValue ) ).substring( 0, 10 ) +
            classifyService.BRACKET_KEYWORDS[1];
    } else if ( startDateValue ) {
        dateRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + dateTimeService.formatUTC( new Date( startDateValue ) ).substring( 0, 10 ) +
            classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
            classifyService.SPACE_KEYWORD + filterPanelUtils_.NO_ENDDATE +
            classifyService.BRACKET_KEYWORDS[1];
    } else if ( endDateValue ) {
        dateRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + dateTimeService.NULLDATE.substring( 0, 10 ) +
            classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
            classifyService.SPACE_KEYWORD + dateTimeService.formatUTC( new Date( endDateValue ) ).substring( 0, 10 ) +
            classifyService.BRACKET_KEYWORDS[1];
    }
    return dateRangeCriteria;
};

/**
 * getHighlightKeywords
 * @param {Object} data search terms to highlight
 * @return {boolean}Returns true if _highlighterSvc.highlightKeywords succeeds
 */
export let getHighlightKeywords = function( data, ctx ) {
    return searchHighlightingService.getHighlightKeywords( data );
};

/**
 *
 */
export let setSelectedObj = function() {
    // TBD - check if required
    appCtxService.ctx.clsLocation.selected = [ {
        searchString: 'Classification Class Id:'
    } ];
    appCtxService.ctx.selected = [ {
        searchString: 'Classification Class Id:'
    } ];
};

/**
 * Sets the input categories
 * @param {Object} data The viewmodel's data object.
 * @returns {boolean} Returns true
 */
export let setOriginalInputCategories = function( data ) {
    if ( data.searchFilterCategories && data.searchFilterCategories.length > 0 ) {
        //Update the provider
        var context = appCtxService.getCtx( 'searchSearch' );
        if ( context ) {
            context.originalInputCategories = _.clone( data.searchFilterCategories );
            appCtxService.updateCtx( 'searchSearch', context );
        }
    }
    return true;
};

/**
 * This method generates a user readable string from the currently active filter map.
 * Filters that are not to be displayed to the user can be removed here.
 * @return {String} active filter String
 */
export let getActiveFilterString = function( ) {
    var searchContext = appCtxService.getCtx( 'search' );
    let category = null; // FIXME this was added to address eslint error & needs to be reviewed by code owner
    if ( searchContext.activeFilterMap ) {
        var searchActiveFilterMap = {};
        var dateRangeCriteria = '';
        var startDateValue;
        var endDateValue;
        if ( category && category.daterange && category.daterange.startDate &&
            category.daterange.startDate.dbValue && category.daterange.startDate.dbValue > 0 ) {
            startDateValue = category.daterange.startDate.dbValue;
        }
        if ( category && category.daterange && category.daterange.endDate &&
            category.daterange.endDate.dbValue && category.daterange.endDate.dbValue > 0 ) {
            endDateValue = category.daterange.endDate.dbValue;
        }
        if ( startDateValue && endDateValue ) {
            dateRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + dateTimeService.formatUTC( new Date( startDateValue ) ).substring( 0, 10 ) +
                classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
                classifyService.SPACE_KEYWORD + dateTimeService.formatUTC( new Date( endDateValue ) ).substring( 0, 10 ) +
                classifyService.BRACKET_KEYWORDS[1];
        } else if ( startDateValue ) {
            dateRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + dateTimeService.formatUTC( new Date( startDateValue ) ).substring( 0, 10 ) +
                classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
                classifyService.SPACE_KEYWORD + filterPanelUtils_.NO_ENDDATE +
                classifyService.BRACKET_KEYWORDS[1];
        } else if ( endDateValue ) {
            dateRangeCriteria = classifyService.BRACKET_KEYWORDS[0] + dateTimeService.NULLDATE.substring( 0, 10 ) +
                classifyService.SPACE_KEYWORD + classifyService.TO_KEYWORD +
                classifyService.SPACE_KEYWORD + dateTimeService.formatUTC( new Date( endDateValue ) ).substring( 0, 10 ) +
                classifyService.BRACKET_KEYWORDS[1];
        }

        _.assign( searchActiveFilterMap, searchContext.activeFilterMap );
        delete searchActiveFilterMap['UpdatedResults.updated_results'];
        delete searchActiveFilterMap['Geolus Criteria'];
        delete searchActiveFilterMap.ShapeSearchProvider;
        delete searchActiveFilterMap.SS1partShapeFilter;
        delete searchActiveFilterMap.SS1shapeBeginFilter;
        delete searchActiveFilterMap.SS1shapeEndFilter;
        return searchFilterSvc.getFilterStringFromActiveFilterMap( searchActiveFilterMap );
    }
    return '';
};

/**
 * getSaveSearchFilterMap
 * @return {Object} saveSearchFilterMap
 */
export let getSaveSearchFilterMap = function() {
    return searchFilterSvc.convertFilterMapToSavedSearchFilterMap();
};

/**
 * getEmptyString
 * @return {String} Empty string ""
 */
export let getEmptyString = function() {
    return '';
};

/**
 * resetCommands sets ctx.visibleServerCommands to null
 */
export let resetCommands = function() {
    appCtxService.ctx.visibleServerCommands = null;
    appCtxService.ctx.clsLocation.prevSelectedClass = null;
};

/**
 * Deselect selected tree node
 * @param {Object} ctx - application context
 */
export let deselectNode = function( data, ctx ) {
    if ( ctx && ctx.clsLocation && ( ctx.clsLocation.selectedTreeNode || ctx.clsLocation.selectedNode ) ) {
        ctx.clsLocation.selectedTreeNode = undefined;
        exports.resetScope( data, ctx );
    }
};

/**
 * Following function takes care of showing the splitter in classification location while launching clasification location
 *
 * */
export let parsetotalFound = function( response ) {
    //Removed, as it was causing searchs with zero results to report 1. Keeping this in-case we decide to reintroduce.
    /* if (response.totalFound === 0) {
        return 1;
    }
    else {
    */
    appCtxService.ctx.clsLocation.startClassSearch = false;
    return response.totalFound;
};

/**
 * initView initialize the view
 * @param {ViewModelObject} data data
 */
export let initView = function() {
    eventBus.publish( 'show.view' );
};

/**
 * Get the default page size used for max to load/return.
 *
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    return awSearchService.getDefaultPageSize( defaultPageSizePreference );
};

/**
 * getSearchSortCriteria gets the selected tab
 * @param {Object} sortCriteria - sort criteria
 * @return {String}Returns sort criteria
 */
export let getSearchSortCriteria = function( sortCriteria, searchState ) {
    /**
     * We should call awSearchService.getSearchSortCriteria only , As we have made generic
     */
    return awSearchService.getSearchSortCriteria( sortCriteria, searchState );
};

/**
 * searchSortClicked sets true if sort serach clicked
 * @param {Object} eventData - eventData
 */
export let searchSortClicked = function( eventData ) {
    if ( eventData.name === 'search' && eventData.target === 'sortCriteria' ) {
        appCtxService.ctx.clsLocation.isSortSearchClicked = true;
    }
};

let addBulkFilter = function( data, category, filter ) {
    data.bulkFiltersMap.searchResultFilters.push(
        {
            searchResultCategory: category.displayName,
            searchResultCategoryInternalName: category.internalName,
            filterValues: [ filter ]
        }
    );
};

/** ----------------- Bulk filtering logic starts ------------------- */
/**
 * Adds/deletes the current filter from the category based on the filter.itemInfo.dbValue.
 * Also removes the whole category from data.bulkFiltersMap if there isn't any entry in the applied filters.
 * @param {object} category Category of which filter is to be added/removed
 * @param {object} filter Filter item
 * @param {ViewModelObject} data data
 */
export let addOrRemoveBulkFilters = function( category, filter, data ) {
    var categoryName = category.internalName;

    if ( filter.isUserInput === true || typeof filter.itemInfo === 'object' && filter.itemInfo.dbValue ) {
        exports.addToBulkFilters( category, filter, data, categoryName );
    } else {
        var index = _.findIndex( data.bulkFiltersMap.searchResultFilters, function( filter ) {
            return filter.searchResultCategoryInternalName === categoryName;
        } );
        if ( index !== -1 ) {
            exports.removeFromBulkFilters( data.bulkFiltersMap.searchResultFilters[ index ], filter, data, categoryName );
            clearBulkFilterForCategory( data, index );
        }
    }

    appCtxService.ctx.clsLocation.isBulkFilterMapDirty = true;
};

/**
 * Adds/removes the current filter from the category based on the !filter.selected
 * Search directives directly fire the apply event before changing the value of filter.selected.
 * Thus negating filter.selected before processing further
 * Also removes the whole category from data.bulkFiltersMap if there isn't any entry in the applied filters.
 * @param {object} category Category of which filter is to be added/removed
 * @param {object} filter Filter item
 * @param {ViewModelObject} data data
 */
export let addOrRemoveSingleFilter = function( category, filter, data ) {
    var categoryName = category.internalName;

    // In generic filter usage, filter selection is not toggled upfront. Thus changing it over here before actual logic.

    var index = -1;
    if( data.bulkFiltersMap.searchResultFilters && data.bulkFiltersMap.searchResultFilters.length > 0 ) {
        for( var idx = 0; idx < data.bulkFiltersMap.searchResultFilters.length; idx++ ) {
            var temp = data.bulkFiltersMap.searchResultFilters[idx];
            if( temp.searchResultCategoryInternalName === categoryName ) {
                if( temp.filterValues && temp.filterValues.length > 0 ) {
                    for( var cdx = 0; cdx < temp.filterValues.length; cdx++ ) {
                        var tempVal = temp.filterValues[cdx];
                        if( tempVal.internalName === filter.internalName ) {
                            index = cdx;
                        }
                    }
                }
            }
        }
    }

    if ( filter.isUserInput === true || index === -1 ) {
        exports.addToBulkFilters( category, filter, data, categoryName );
    } else {
        var index = _.findIndex( data.bulkFiltersMap.searchResultFilters, function( filter ) {
            return filter.searchResultCategoryInternalName === categoryName;
        } );
        if ( index !== -1 ) {
            exports.removeFromBulkFilters( data.bulkFiltersMap.searchResultFilters[ index ], filter, data, categoryName );
            clearBulkFilterForCategory( data, index );
        }
    }
};

let showRangeError = function( category, data ) {
    // Can't add a range filter since there are already some filter values added
    data.selectedCategory = category;
    messagingService.reportNotyMessage( data, data._internal.messages, 'rangeOrCheckboxFilter' );
};

let handleFilterWithRangeAdditionToBulkFilters = function( category, filter, data, categoryName, isDateFilter ) {
    var tmpCategoryName = filter.categoryName ? filter.categoryName : categoryName;
    var index = getIndexInFilterValuesArray( data.bulkFiltersMap.searchResultFilters, tmpCategoryName, isDateFilter );
    if ( index !== -1 ) {
        var tmpCategory = data.bulkFiltersMap.searchResultFilters[index];
        if ( tmpCategory.filterValues.length >= 1 ) {
            // Special case for Date/Numeric filters - range and checkbox filter can't be applied simultaneously.
            if ( filter.isUserInput === true ) {
                if ( tmpCategory.filterValues[0].isUserInput === true ) {
                    //Replace old range with new
                    tmpCategory.filterValues[0] = filter;
                } else {
                    showRangeError( category, data );
                }
            } else if ( tmpCategory.filterValues[0].isUserInput === true ) {
                // The previously added value to bulk filters is user input thus can't add a new value
                if ( typeof filter.itemInfo === 'object' && filter.itemInfo.dbValue ) {
                    // If it's a checkbox selection this time, set the checkbox value to false.
                    filter.itemInfo.dbValue = false;
                } else {
                    filter.selected = false;
                }
                showRangeError( category, data );
            } else {
                tmpCategory.filterValues.push( filter );
            }
            // data.selectedCategory used for showing the message. Thus remove it once work is done
            delete data.selectedCategory;
        } else {
            tmpCategory.filterValues.push( filter );
        }
    } else {
        addBulkFilter( data, category, filter );
    }

    // If it is a date range addition do not update the filter values. Hence return from this function
    if ( filter.isUserInput === true ) {
        return;
    }

    if ( isDateFilter ) {
        // From the searchFilterMap, reset all the filters for current category i.e. 0Z0_year, etc except for the selected one.
        appCtxService.ctx.searchResponseInfo.searchFilterMap[filter.categoryName].forEach( function( filterItem ) {
            if ( filterItem.stringValue === filter.internalName ) {
                filterItem.selected = true;
            } else {
                filterItem.selected = false;
            }
        } );

        /*
        Concept: We will pass getCategories2 only the "Vendor Reference Date"(Classification.N40932) category
                    and the complete searchFilterMap(category values from PSVM3 whose one of the filter values for Classification.N40932_0Z0_year would be set to true).
        getCategories2 usually creates and returns categories array list which is used for displaying.
        But instead of using it for calculating all the filter values, we use it only to calculate values to be displayed for date filter.
        */
        // Calling the getCategories2 which will return the complete list of filterValues to be shown for current selection
        var recalculatedCategories = filterPanelService_.getCategories2( [ category ], appCtxService.ctx.searchResponseInfo.searchFilterMap, undefined, undefined, true, undefined, true );
        for ( var objectKey in recalculatedCategories.refineCategories[0] ) {
            category[objectKey] = recalculatedCategories.refineCategories[0][objectKey];
        }
    }
};

/**
 * Adds the current filter to the category
 * @param {object} category Category of which filter is to be added/removed
 * @param {object} filter Filter item
 * @param {ViewModelObject} data data
 * @param {String} categoryName Name of the category
 */
export let addToBulkFilters = function( category, filter, data, categoryName ) {
    // This is addition to bulk filters
    if ( !data.bulkFiltersMap.searchResultFilters ) {
        data.bulkFiltersMap.searchResultFilters = [];
    }
    var isDateFilter = category.type === filterPanelUtils_.DATE_FILTER;

    // Special case for Date filters
    if ( isDateFilter || category.type === 'NumericFilter' ) {
        handleFilterWithRangeAdditionToBulkFilters( category, filter, data, categoryName, isDateFilter );
    } else {
        var index = getIndexInFilterValuesArray( data.bulkFiltersMap.searchResultFilters, filter.categoryName, false );
        if ( index !== -1 ) {
            data.bulkFiltersMap.searchResultFilters[index].filterValues.push( filter );
        } else {
            addBulkFilter( data, category, filter );
        }
    }
};

/**
 * Removes the current filter from the category
 * @param {object} category Category of which filter is to be added/removed
 * @param {object} filter Filter item
 * @param {ViewModelObject} data data
 * @param {String} categoryName Name of the category
 */
export let removeFromBulkFilters = function( category, filter, data, categoryName ) {
    var index = _.findIndex( category.filterValues, function( tmp ) {
        return tmp.internalName === filter.internalName;
    } );
    // If element already exists in the applied filters, process it to be removed.
    if ( index !== -1 ) {
        if ( filter.itemInfo && filter.itemInfo.dbValue ) {
            filter.itemInfo.dbValue = false;
        } else if( filter.itemInfo === undefined &&  data.autoUpdateEnabled &&
            data.autoUpdateEnabled.dbValue !== true ) {
            //find the category and filter
            if( data.categories && data.categories.refineCategories ) {
                var index =  _.findIndex( data.categories.refineCategories, function( temp ) {
                    return temp.internalName === category.searchResultCategoryInternalName;
                } );

                for( var i = 0; i < data.categories.refineCategories[index].filterValues.length; i++ ) {
                    if( data.categories.refineCategories[index].filterValues[i].internalName === filter.internalName ) {
                        data.categories.refineCategories[index].filterValues[i].itemInfo.dbValue = false;
                    }
                }
            }
        }
        var isDateFilter = filter.type === filterPanelUtils_.DATE_FILTER;
        if( !isDateFilter ) {
            isDateFilter = filter.type === filterPanelUtils_.DATE_DRILLDOWN_FILTER;
        }
        // Special case for date filters
        if ( isDateFilter ) {
            // Start from the last value in the bulk filters array while removing date filters and go on till user selection
            var count = category.filterValues[index].drilldown === 3 ? 1 : category.filterValues.length - index;
            //if selected filter is day, delete only that filter, else delete all below the selected filter
            category.filterValues.splice( index, count );
        } else {
            // For other filters, simply remove that value from the filters.
            category.filterValues.splice( index, 1 );
        }
    }
};

/**
 * Adds numeric range to the bulk filter
 * @param {Object} category - the category of the selected filter
 * @param {ViewModelObject} data - data
 */
export let addNumericRange = function( category, data ) {
    var startRange = parseFloat( category.numericrange.startValue.dbValue );
    if ( isNaN( startRange ) ) {
        startRange = undefined;
    }
    var endRange = parseFloat( category.numericrange.endValue.dbValue );
    if ( isNaN( endRange ) ) {
        endRange = undefined;
    }
    if ( filterPanelUtils_.checkIfValidRange( category, startRange, endRange ) ) {
        var internalName = filterPanelUtils_.getNumericRangeString( startRange, endRange );
        var internalFilter = filterPanelUtils_.getNumericRangeFilter( internalName.substring( 14, internalName.length ) );
        this.addOrRemoveBulkFilters( category, {
            internalName: internalName,
            isUserInput: true,
            name: searchFilterSvc.getBreadCrumbDisplayValue( [ internalFilter ], internalName )
        }, data );
    }
};

/**
 * Searches the numeric range and updates the current category with filterValues
 * @param {Object} category - the category of the selected filter
 * @param {ViewModelObject} data - data
 */
export let searchNumericRangeInFilterValues = function( category, data ) {
    // Get the start and end values of the range
    var startRange = parseFloat( category.numericrange.startValue.dbValue );
    if ( isNaN( startRange ) ) {
        startRange = undefined;
    }
    var endRange = parseFloat( category.numericrange.endValue.dbValue );
    if ( isNaN( endRange ) ) {
        endRange = undefined;
    }
    if ( filterPanelUtils_.checkIfValidRange( category, startRange, endRange ) ) {
        // Use filter panel utils to get the numeric range filter and create searchFilterMap
        var internalName = filterPanelUtils_.getNumericRangeString( startRange, endRange );
        var filterForPFS = filterPanelUtils_.getNumericRangeFilter( internalName.substring( 14, internalName.length ) );

        filterForPFS.stringValue = '*'; // * is to be sent as stringValue for range searches

        var searchFilterMap = {};
        searchFilterMap[category.internalName] = [ filterForPFS ];

        // Set the activeFilterMap and valueCategory in the ctx which is used by getFilterMap to create searchInput for performFacetSearch
        appCtxService.ctx.search.activeFilterMap = searchFilterMap;
        appCtxService.ctx.search.valueCategory = category;

        eventBus.publish( 'classifyFilter.init' );
    }
};

/**
 * Adds date range to the bulk filter
 * @param {Object} category - the category of the selected filter
 * @param {ViewModelObject} data - data
 */
export let addDateRange = function( category, data ) {
    // Get the start and end values of the range
    var startValue = category.daterange.startDate.dateApi.dateObject;
    var endValue = category.daterange.endDate.dateApi.dateObject;

    var internalName = filterPanelUtils_.getDateRangeString( startValue, endValue );
    var internalFilter = filterPanelUtils_.getDateRangeFilter( internalName.substring( 12, internalName.length ) );
    this.addOrRemoveBulkFilters( category, {
        internalName: internalName,
        isUserInput: true,
        name: searchFilterSvc.getBreadCrumbDisplayValue( [ internalFilter ], internalName )
    }, data );
};

/**
 * Adds date range to the bulk filter
 * @param {Object} category - the category of the selected filter
 * @param {ViewModelObject} data - data
 */
export let addDateRangeFromProperties = function( attribute, data ) {
    // Get the start and end values of the range
    var startValue = attribute.attr.daterange.startDate.dbOriginalValue;
    var endValue = attribute.attr.daterange.endDate.dbOriginalValue;

    var internalName = filterPanelUtils_.getDateRangeString( startValue, endValue );
    return filterPanelUtils_.getDateRangeFilter( internalName.substring( 12, internalName.length ) );
};

/**
 * Searches the date range and updates the current category with filterValues
 * @param {Object} category - the category of the selected filter
 * @param {ViewModelObject} data - data
 */
export let searchDateRangeInFilterValues = function( category, data ) {
    // Get the start and end values of the range
    var startValue = category.daterange.startDate.dateApi.dateObject;
    var endValue = category.daterange.endDate.dateApi.dateObject;

    // Use filter panel utils to get the date range filter and create searchFilterMap
    var internalName = filterPanelUtils_.getDateRangeString( startValue, endValue );
    var filterForPFS = filterPanelUtils_.getDateRangeFilter( internalName.substring( 12, internalName.length ) );

    var searchFilterMap = {};
    searchFilterMap[category.internalName] = [ filterForPFS ];

    // Set the activeFilterMap and valueCategory in the ctx which is used by getFilterMap to create searchInput for performFacetSearch
    appCtxService.ctx.search.activeFilterMap = searchFilterMap;
    appCtxService.ctx.search.valueCategory = category;

    var index = getIndexInFilterValuesArray( data.bulkFiltersMap.searchResultFilters, category.internalName, true );
    if ( index !== -1 ) {
        this.removeAllFilterValues( data.bulkFiltersMap.searchResultFilters[index].filterValues, category.internalName, 0, data );
    }
};

/**
 * Directly add a particular string to the bulk filter for given category
 * @param {Object} category - The category of the selected filter
 * @param {ViewModelObject} data - data
 */
export let addStringFilter = function( category, data ) {
    if ( category.filterBy !== '' ) {
        // Create a filterForBulk which is to be added and pass it to addOrRemoveBulkFilters
        // isUserInput - This is to be set to true in case filters are not added using checkbox
        var filterForBulk = {
            name: category.filterBy,
            internalName: category.filterBy,
            type: 'StringFilter',
            isUserInput: true
        };
        exports.addOrRemoveBulkFilters( category, filterForBulk, data );
    }
};

/**
 * Gets the bulk filter map and returns the appropriate filterMap which can be passed to TcSoaService call for performSearchViewModel4
 * @param {Object} bulkFiltersMap The bulk filter map which is to be applied
 * @returns {Object} filterMap which is to be passed as a parameter to TcSoaService
 */
export let getBulkFilterMap = function( bulkFiltersMap ) {
    if ( appCtxService.ctx.SearchSimilarActive ) {
        return searchSimilarService.getFilterMapForSearchSimilar();
    }
    if ( typeof bulkFiltersMap !== 'object' ) {
        return {};
    }
    var filterMapToSend = {};

    //Restore saveBulkFilters, if any
    var ctx = appCtxService.getCtx( 'clsLocation' );
    if ( ctx.savedFilters ) {
        bulkFiltersMap = _.cloneDeep( ctx.savedFilters.filters );
        if ( !bulkFiltersMap ) {
            bulkFiltersMap = {};
        }
    }

    //Build up filter map
    _.forEach( bulkFiltersMap.searchResultFilters, function( bulkFilterMapValue ) {
        //Map is used directly by data provider
        bulkFilterMapValue.filterValues.forEach( function( filterInfo ) {
            var filter = {};
            var filterInternalName = filterInfo.internalName;

            if ( _.startsWith( filterInternalName, filterPanelUtils_.INTERNAL_DATE_FILTER ) ) {
                filter = filterPanelUtils_.getDateRangeFilter( filterInternalName.substring( 12, filterInternalName.length ) );
            } else if ( _.startsWith( filterInternalName, filterPanelUtils_.INTERNAL_NUMERIC_RANGE ) ) {
                filter = filterPanelUtils_.getNumericRangeFilter( filterInternalName.substring( 14, filterInternalName.length ) );
            } else if ( _.startsWith( filterInternalName, filterPanelUtils_.INTERNAL_NUMERIC_FILTER ) ) {
                //SOA handles numeric filters differently in aw4.0.
                //So we need to pass "StringFilter" until server side is changed to be the same as aw3.4.
                //filter.searchFilterType = "NumericFilter";
                filter.searchFilterType = 'StringFilter';
                var numericValue = parseFloat( filterInternalName.substring( 15, filterInternalName.length ) );
                if ( !isNaN( numericValue ) ) {
                    filter.startNumericValue = numericValue;
                    filter.endNumericValue = numericValue;
                }
                filter.stringValue = filterInternalName.substring( 15, filterInternalName.length );
            } else if ( _.startsWith( filterInternalName, filterPanelUtils_.INTERNAL_OBJECT_FILTER ) ) {
                //SOA handles object filters differently in aw4.0.
                //So we need to pass "StringFilter" until server side is changed to be the same as aw3.4
                //filter.searchFilterType = "ObjectFilter";
                filter.searchFilterType = 'StringFilter';
                filter.stringValue = filterInternalName.substring( 14, filterInternalName.length );
            } else if ( filterInfo.type === 'NumericFilter' ) {
                //SOA handles numeric filters differently in aw4.0.
                //So we need to pass "StringFilter" until server side is changed to be the same as aw3.4.
                //filter.searchFilterType = "NumericFilter";
                filter.searchFilterType = 'StringFilter';
                filter.startNumericValue = filterInfo.startNumericValue;
                filter.endNumericValue = filterInfo.endNumericValue;
                filter.stringValue = filterInternalName;
            } else {
                filter.searchFilterType = 'StringFilter';
                filter.stringValue = filterInternalName;
            }
            // To Handle Case - For date filters need to send values with key as dateCategory_0Z0_year/year_month/week etc. which is available as filterInfo.categoryName
            var categoryNameToBeUsed = filterInfo.categoryName || bulkFilterMapValue.searchResultCategoryInternalName;
            if ( typeof filterMapToSend[categoryNameToBeUsed] === 'undefined' ) {
                filterMapToSend[categoryNameToBeUsed] = [];
            }
            filterMapToSend[categoryNameToBeUsed].push( filter );
        } );
    } );

    return filterMapToSend;
};

/**
 * This will clone and copy the bulkFiltersMap from data to the ctx which is then used by loadData for fetching data from server.
 * @param {ViewModelObject} data - data
 */
export let copyBulkFiltersToCtx = function( data ) {
    var ctx = appCtxService.getCtx( 'clsLocation' );
    // Deep clone the bulk filter map so that changes between two applyAll/clearAll are not sent to performSearchViewModel4 while changing from List view to table view or viceversa
    ctx.bulkFiltersMap = _.cloneDeep( data.bulkFiltersMap );
    ctx.isBulkFilterMapDirty = false;
    ctx.isBulkFilterUpdateEvent = true;
    ctx.savedFilters.filters = _.cloneDeep( data.bulkFiltersMap );
    appCtxService.updateCtx( 'clsLocation', ctx );

    eventBus.publish( 'updateObjectGrid' );
};

/**
 * Publishes event to update the grid so that the grid calls the loadData with the latest bulkFilterMap
 */
export let updateObjectGrid = function( data ) {
    if ( data.resultsIcon.uiValue === 'Table' ) {
        eventBus.publish( 'gridView.plTable.reload' );
    } else if ( data.resultsIcon.uiValue === 'List' ) {
        // For ApplyAll/clearAll to work in list view, publish event which will update the list
        eventBus.publish( 'show.view' );
    }
};


/**
 * Called when user clicks on clearAll.
 * Concept: clearAll is nothing but applyAll provided there are no bulkFilters.
 * @param {Object} category - the category of the selected filter
 * @param {Object} filter - filter value
 * @param {ViewModelObject} data - data
 */
export let clearAll = function( category, filter, data ) {
    if ( data.autoUpdateEnabled.dbValue ) {
        this.clearBulkFilterMap( category, filter, data );
        eventBus.publish( 'propertiesPanel.applyAll' );
    } else {
        _.forEach( data.bulkFiltersMap.searchResultFilters, function( searchFilter ) {
            exports.removeAllFilterValues( searchFilter.filterValues, searchFilter.searchResultCategoryInternalName, undefined, data );
        } );
        data.bulkFiltersMap = {};
        this.clearSearchIndividualCategory();
        this.copyBulkFiltersToCtx( data );
    }
};

/**
 * Clears the bulk filters area i.e. bulkFiltersMap, categories and valueCategory which is used for updating single category in filter display
 * @param {Object} category - the category of the selected filter
 * @param {Object} filter - filter value
 * @param {ViewModelObject} data - data
 */
export let clearBulkFilterMap = function( category, filter, data ) {
    data.bulkFiltersMap = {};
    data.categories = [];
    this.clearSearchIndividualCategory();
    this.copyBulkFiltersToCtx( data );
};

let clearBulkFilterForCategory = function( data, index ) {
    if ( data.bulkFiltersMap.searchResultFilters[index].filterValues.length === 0 ) {
        if ( data.bulkFiltersMap.searchResultFilters.length === 1 ) {
            //if only one filter, delte search result filters
            data.bulkFiltersMap.searchResultFilters = [];
        } else {
            data.bulkFiltersMap.searchResultFilters.splice( index, 1 );
        }
        appCtxService.ctx.clsLocation.isBulkFilterMapDirty = true;
    }
};

/**
 * Removes all filter values from the bulk filter section for a particular category(will also sync it with the checkboxes displayed in the filters display section)
 * @param {Array} appliedFilterArray AppliedFilters array for the category
 * @param {String} categoryName Name of the category whose filters are to be removed
 * @param {Number} indexToBeRemoved Not used
 * @param {ViewModelObject} data - data
 */
export let removeAllFilterValues = function( appliedFilterArray, categoryName, indexToBeRemoved, data ) {
    /*
    Logic: While removing all the filters, also need to clear the checkboxes from the filter display section.
    Thus, setting the itemInfo.dbValue to false, and calling addOrRemoveBulkFilters with it.
    Since addOrRemoveBulkFilters will modify the appliedFilters array, looping on a cloned array.
    At last remove the complete category from the bulkFiltersMap
    */
    var index = _.findIndex( data.bulkFiltersMap.searchResultFilters, function( filter ) {
        return filter.searchResultCategoryInternalName === categoryName;
    } );
    appliedFilterArray.slice( 0 ).forEach( function( item ) {
        if ( typeof item.itemInfo === 'object' && item.itemInfo.dbValue === true ) {
            // Perform removal of all the filters.
            item.itemInfo.dbValue = false;
            if ( index !== -1 ) {
                if ( typeof data.bulkFiltersMap.searchResultFilters[ index ] === 'object' ) {
                    exports.addOrRemoveBulkFilters( data.bulkFiltersMap.searchResultFilters[ index ], item, data );
                }
            }
        }
    } );

    if ( index !== -1 ) {
        // delete data.bulkFiltersMap.searchResultFilters[index];
        data.bulkFiltersMap.searchResultFilters.splice( index, 1 );
    }
};

/**
 * Removes a single filter value from the bulk filter section.(will also sync it with the checkboxes displayed in the filters display section)
 * @param {ViewModelObject} data - data
 * @param {Object} prop prop
 * @param {Objectg} filterValue filter value
 */
export let removeFilters = function( data, prop, filterValue ) {
    var categoryName = prop.searchResultCategoryInternalName;
    var index = _.findIndex( data.bulkFiltersMap.searchResultFilters, function( filter ) {
        return filter.searchResultCategoryInternalName === categoryName;
    } );
    if( filterValue !== null ) {
        exports.removeFromBulkFilters( data.bulkFiltersMap.searchResultFilters[index], filterValue, data );
    } else {
        if ( prop.filterValues.length === 1 ) {
            var tmpFilter = prop.filterValues[ 0 ];
            exports.removeFromBulkFilters( data.bulkFiltersMap.searchResultFilters[index], tmpFilter, data );
        } else {
            _.forEach( data.bulkFiltersMap.searchResultFilters[index].filterValues, function( filter ) {
                if ( filter.itemInfo && filter.itemInfo.dbValue ) {
                    filter.itemInfo.dbValue = false;
                }
            } );
            data.bulkFiltersMap.searchResultFilters[index].filterValues = [];
        }
    }
    clearBulkFilterForCategory( data, index );
};


/**
 * Calls the appropriate update for updating the category and it's filterValues.
 * If update is called because of -> more/less/server side more/expanding unpopulated category, then only update the selected category
 * @param {ViewModelObject} data - data
 */
export let callAppropriateUpdate = function( data ) {
    if ( typeof appCtxService.ctx.search.valueCategory === 'object' ) {
        eventBus.publish( 'updateOnlySelectedCategory' );
    } else {
        eventBus.publish( 'updateAllCategories' );
    }
};

/**
 * Calls the filterPanelService's getCategories2 to get the refineCategories for only selected category
 * @param {ViewModelObject} data - data
 * @param {Object} categoryToBeUpdated - Category object which is to be updated
 */
export let updateSelectedCategory = function( data, categoryToBeUpdated ) {
    // Re-Use getCategories2 of filterPanelService to compute the category along with filterValues to be displayed in it.
    // Only pass the categoryToBeUpdated, so that other categories are not affected.
    var recalculatedCategories = filterPanelService_.getCategories2( [ categoryToBeUpdated ], appCtxService.ctx.search.filterMap, undefined, undefined, true, undefined, true );
    for ( var objectKey in recalculatedCategories.refineCategories[0] ) {
        categoryToBeUpdated[objectKey] = recalculatedCategories.refineCategories[0][objectKey];
    }
    if ( data.bulkFiltersMap.searchResultFilters ) {
        var isDateFilter = categoryToBeUpdated.type === filterPanelUtils_.DATE_FILTER;
        var index = getIndexInFilterValuesArray( data.bulkFiltersMap.searchResultFilters, categoryToBeUpdated.internalName, isDateFilter );
        if ( index !== -1  && data.bulkFiltersMap.searchResultFilters[index].filterValues ) {
            // If there are any values in the appliedFilters for categoryToBeUpdated, also update the references for it from the new categoryToBeUpdated.filterValues
            categoryToBeUpdated.filterValues.forEach( function( filterItem ) {
                var appliedFiltersIndex = _.findIndex( data.bulkFiltersMap.searchResultFilters[index].filterValues, function( filter ) {
                    return filterItem.internalName === filter.internalName;
                } );

                if ( appliedFiltersIndex !== -1 ) {
                    filterItem.selected = true;
                }
            } );
        }
    }
    this.clearSearchIndividualCategory();
};

/**
 * Clears the valueCategory( used for updating only valueCategory's filterValues)
 * and activeFilterMap( used for preparing searchInput for performFacetSearch)
 */
export let clearSearchIndividualCategory = function() {
    delete appCtxService.ctx.search.valueCategory;
    appCtxService.ctx.search.activeFilterMap = {};
};

/**
 * Finds the index of item object in the inputArray(array of objects) based on a uniqueProperty
 * @param {Array} inputArray - Array in which index is to be found
 * @param {String} categoryName  - category Name
 * @param {Boolean} isDateFilter - true if date filter, false otherwise
 * @returns {Number} Index of the item in inputArray
 */
export let getIndexInFilterValuesArray = function( inputArray, categoryName, isDateFilter ) {
    var index = -1;
    inputArray.forEach( function( element, elementIndex ) {
        if ( element.searchResultCategoryInternalName === categoryName ) {
            index = elementIndex;
        } else {
            //check if date filter
            if ( isDateFilter ) {
                var tmpCategoryName = categoryName.substring( 0, categoryName.indexOf( '_0Z0_' ) );
                if ( element.searchResultCategoryInternalName === tmpCategoryName ) {
                    index = elementIndex;
                }
            }
        }
    } );
    return index;
};


/* Supporting functions to call the awSearchService's corresponding functions with the given arguments */
/* This is required while calling a SOA from view model, where most of the functions are from awSearchService,
    but some functions to be called from classifySearchService
*/
/**
 * Calls the awSearchService's getFilterMap
 */
export let getFilterMap = function( filterMap, category ) {
    // Return value should contain applied bulk filter map. Thus merge the filter map along with already applied bulk filters.
    //If filterMap is undefined elts reset it back
    if ( filterMap === undefined || filterMap === null ) {
        filterMap = {};
        appCtxService.ctx.search.activeFilterMap = {};
    }
    var appliedBulkFilterMap = exports.getBulkFilterMap( appCtxService.ctx.clsLocation.bulkFiltersMap );
    // var index = _.findIndex( appliedBulkFilterMap.searchResultFilters, function( filter ) {
    //     return filter.searchResultCategoryInternalName === category.internalName;
    // } );
    // if ( index !== -1 ) {
    // We should not send the current category as part of bulk filter map.
    if ( typeof appliedBulkFilterMap[category.internalName] !== 'undefined' ) {
        delete appliedBulkFilterMap[category.internalName];
    }
    // delete appliedBulkFilterMap.searchResultFilters[ index ];
    // }
    return Object.assign( appliedBulkFilterMap, {} );
};

/**
 * Calls the awSearchService's getStartIndexForFilterValueSearch
 */
export let getStartIndexForFilterValueSearch = function() {
    return {};
};

/**
 * Calls the awSearchService's setFilterMap
 */
export let setFilterMap = function() {
    return {};
};

export const processOutput = ( data, dataCtxNode, searchData ) => {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};

/** ----------------- Bulk filtering logic ends ------------------- */

export default exports = {
    processOutput,
    viewerChanged,
    formatAttrForFilterCompatibility,
    setPanelIsClosedOnCtx,
    searchClassOrFilters,
    mapAttributesWithProperties,
    resetImageViewer,
    resetScope,
    resetTreeHierarchy,
    getClassImageViewModel,
    refreshViewerGallery,
    formatImageAttachments,
    setImageTitle,
    onPrevChevron,
    onNextChevron,
    showImageViewer,
    backToVNCTab,
    loadListData,
    loadTableData,
    loadMRUObjects,
    getEmptyFilterMap,
    getClsSearchCriteria,
    getClsSearchCriteriaForFacetSearch,
    getDefaultPageSize,
    getFacetSearchCriteriaForNumericFilter,
    getFacetSearchCriteriaForDateFilter,
    getHighlightKeywords,
    setSelectedObj,
    setOriginalInputCategories,
    getActiveFilterString,
    getSaveSearchFilterMap,
    getEmptyString,
    resetCommands,
    deselectNode,
    parsetotalFound,
    initView,
    getSearchSortCriteria,
    searchSortClicked,
    addOrRemoveBulkFilters,
    addOrRemoveSingleFilter,
    addToBulkFilters,
    removeFromBulkFilters,
    addNumericRange,
    searchNumericRangeInFilterValues,
    addDateRange,
    addDateRangeFromProperties,
    searchDateRangeInFilterValues,
    addStringFilter,
    getBulkFilterMap,
    copyBulkFiltersToCtx,
    updateObjectGrid,
    clearAll,
    clearBulkFilterMap,
    removeFilters,
    removeAllFilterValues,
    callAppropriateUpdate,
    updateSelectedCategory,
    clearSearchIndividualCategory,
    getIndexInFilterValuesArray,
    getFilterMap,
    getStartIndexForFilterValueSearch,
    setFilterMap,
    resetScopeForFilterPanel,
    toggleBulkFiltering,
    getInfoMessages,
    clsLocationLaunched
};
