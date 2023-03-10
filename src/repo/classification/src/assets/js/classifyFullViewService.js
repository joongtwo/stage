/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This is a service that contains method for classification tab
 *
 * @module js/classifyFullViewService
 */
import uwPropertyService from 'js/uwPropertyService';
import soaService from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import TcServerVersion from 'js/TcServerVersion';
import iconSvc from 'js/iconService';
import classifyFilterUtils from 'js/classifyFilterUtils';
import classifyNodeSvc from 'js/classifyNodeService';
import classifySvc from 'js/classifyService';
import classifyTblSvc from 'js/classifyFullviewTableService';
import classifyUtils from 'js/classifyUtils';
import classifyLovSvc from 'js/classifyLOVService';
import classifyViewSvc from 'js/classifyViewService';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import analyticsSvc from 'js/analyticsService';

var exports = {};
export let NON_COMPLEX_VMO_COUNT = 3;
export let COMPLEX = 5;
export let LOWEST_NON_COMPLEX_TYPE = 4;
export let COMPLEX_POSITION = 8;
export let ECLASSRELEASES = 'CST_supported_eclass_releases';
export let PRESENTATION = 'CLS_is_presentation_hierarchy_active';
//Convert values always gets called twice on starting an edit operation, thus the count needs to be kept to ensure it is only call
//at the right time.
var initialConvertCount = 0;
var suggestedClassSelected = false;


/**
 *  Use case : If user tries to paste the ico, which is deleted, following method would reset the view
 * @param {*} data The declarative view model
 * @param {*} ctx  Application context
 */
export let setNotifyMessage = function( data, ctx ) {
    if( appCtxSvc.getCtx( 'notifyMessage' ) === undefined || appCtxSvc.getCtx( 'notifyMessage' ) === false ) {
        appCtxSvc.updateCtx( 'notifyMessage', true );
        appCtxSvc.updateCtx( 'classifyEdit', true );
        exports.resetView( data );
    }
    return true;
};

/**
 * Creates a new entry for data.attr_anno to display an id field for standalone classification.
 * @param {*} data The declarative view model
 */
export let buildStandaloneIDField = function( data ) {
    var metricAndNonMetric = {
        unitName: '',
        defaultValue: '',
        minimumValue: '',
        maximumValue: '',
        formatDefinition: {
            formatType: 0,
            formatModifier1: 0,
            formatModifier2: 0,
            formatLength: 80
        }
    };

    var id = 'Id';
    var ico_ID = 'ICO_ID';
    var ATTRIBUTE_NAME = 'ATTRIBUTE_NAME';
    var zero = 0;

    data.standalone_attr_anno = [];
    var attributesDefinitions = [ {
        attributeId: ico_ID,
        arraySize: zero,
        options: zero,
        metricFormat: metricAndNonMetric,
        nonMetricFormat: metricAndNonMetric,
        attributeProperties: [
            {
                propertyId: ATTRIBUTE_NAME,
                propertyName: '',
                values: [
                    {
                        internalValue: id,
                        displayValue: id
                    }
                ]
            }
        ]
    } ];

    classifySvc.formatAttributeArray( data, null, attributesDefinitions, null, data.standalone_attr_anno, '', false, false, null, null, null );

    //setting this to make the id field required
    if( data.standalone_attr_anno ) {
        data.standalone_attr_anno[0].vmps[0].isRequired = true;
    }

    return data.standalone_attr_anno;
};

/**
 * Deletes an ICO in recents section if the object is synced and the ICO appears in PWA
 * @param {} ctx The application context
 * @param {Object} context search state
 */
export let updateRecentsAfterObjectSync = function( searchResults, context ) {
    var pwaObjects = searchResults.objects ? searchResults.objects : searchResults;
    if( context && context.searchState && context.searchState.value && context.searchState.value.standAloneObjects && context.searchState.value.standAloneObjects.length > 0 ) {
        const tmpContext = { ...context.searchState.value };
        var standAloneObjects = tmpContext.standAloneObjects;
        var isRecent = false;
        var selectedClassId = context.searchState.selectedNode.id;
        for ( var i = 0; i < standAloneObjects.length; i++ ) {
            var classId = standAloneObjects[i].classId;
            if ( classId === selectedClassId ) {
                isRecent = true;
                break;
            }
        }
        var newStandAloneObjects = _.clone( standAloneObjects );
        _.forEach( newStandAloneObjects, function( sObj ) {
            var idx = _.findIndex( pwaObjects, function( pObj ) {
                return pObj.uid === sObj.uid;
            } );
            if ( idx !== -1 ) {
                standAloneObjects.splice( idx );
            }
        } );
        tmpContext.standAloneObjects = standAloneObjects;
        tmpContext.isRecent = isRecent;
        context.searchState.update( tmpContext );
    }
};


/**
 * Execute the Create Classification Object command is being executed
 * @param {Object} commandContext Command context
 */
export let createStandaloneVMO = function( commandContext ) {
    const tmpContext = { ...commandContext.searchState.value };
    tmpContext.standAlone = true;
    commandContext.searchState.update( tmpContext );
};


/**
 * The pasteCommandHide hides the paste command if the copied context is deleted.
 * @param context Application context
 */
export let pasteCommandHide = function( context ) {
    var commandContext = context;
    if( appCtxSvc.getCtx( 'IcoUID' ) === commandContext.vmo.icoUid ) {
        appCtxSvc.unRegisterCtx( 'IcoReplica' );
    }
};

/**
 * Get classifiable Work space objects list
 *
 */

export let getClassifyNonClassify = function( response, classifyState ) {
    var classifiableWSOList = [];
    if( response && response.wso2ClassifyMap ) {
        var isClassify = false;
        var wso2Classify = response.wso2ClassifyMap;
        if( wso2Classify[ 1 ][ 0 ] ) {
            isClassify = true;
            classifiableWSOList.push( wso2Classify[ 0 ][ 0 ] );
        }
        const tmpState = { ...classifyState.value };
        tmpState.isClassify = isClassify;
        classifyState.update( tmpState );
    }
    return classifiableWSOList;
};


/**
 * Update cell tooltips
 * @param {ObjectArray} cellProps
 * @param {ObjectArray} propValues
 */
function updateCellProps( cellProps, propValues ) {
    if( propValues && typeof propValues === 'object' ) {
        _.forEach( cellProps, function( prop ) {
            if( prop.key === 'Date Modified' ) {
                var lastModifiedDate = classifySvc.getPropertyValue( propValues.properties, classifySvc.UNCT_MODIFY_DATE );
                if( lastModifiedDate ) {
                    lastModifiedDate = classifyUtils.convertClsDateToAWTileDateFormat( lastModifiedDate );
                }
                prop.value = lastModifiedDate.displayValue;
            }
            if( prop.key === 'Modified User' ) {
                var lastModifiedUser = classifySvc.getPropertyValue( propValues.properties, classifySvc.UNCT_MODIFY_USER );
                prop.value = lastModifiedUser;
            }
        } );
    }
}


/*
 * Generates the cells to be displayed in 'View' mode
 *
 * @param {Object} response - the SOA response
 */
export let generateCells = function( response ) {
    var cells = [];

    appCtxSvc.registerCtx( 'ICO_response', response );

    if( response && response.clsObjectDefs && !_.isEmpty( response ) ) {
        var classDefResponse = response.clsClassDescriptors;

        _.forEach( response.clsObjectDefs[ 1 ][ 0 ].clsObjects, function( clsObj ) {
            var classId = classifySvc.getPropertyValue( clsObj.properties, classifySvc.UNCT_CLASS_ID );
            // Also store parentIds to be used in case of edit class. We need to expand the hierarchy upto the classified class while reclassifying.
            var parentIds = [];
            var parents = classifySvc.getParentsPath( response.classParents[ classId ].parents, parentIds );
            var currentClassName = classifySvc.getPropertyValue( classDefResponse[ classId ].properties,
                classifySvc.UNCT_CLASS_NAME );

            var iconAvailable = false;
            var iconPosition = -1;
            var ticket = {};
            if( classDefResponse && classDefResponse[ classId ] &&
                classDefResponse[ classId ].documents ) {
                var documents = classDefResponse[ classId ].documents;
                var iconindex = 0;
                _.forEach( documents, function( document ) {
                    if( document.documentType === 'icon' ) {
                        iconPosition = iconindex;
                    }
                    iconindex++;
                } );
            }
            if( iconPosition !== -1 ) {
                ticket = classDefResponse[ classId ].documents[ iconPosition ].ticket;
            } else {
                // Get the class icon for the ICO's class.
                if( classDefResponse && classDefResponse[ classId ] &&
                    classDefResponse[ classId ].documents &&
                    classDefResponse[ classId ].documents[ 0 ] ) {
                    ticket = classDefResponse[ classId ].documents[ 0 ].ticket;
                }
            }

            if( ticket && classifyUtils.isSupportedImageType( ticket ) ) {
                iconAvailable = true;
            }

            if( iconAvailable === true ) {
                var imageIconUrl = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
                    fmsUtils.getFilenameFromTicket( ticket ) + '?ticket=' + ticket;
            } else {
                // If the class doesn't have an image, then display the 'default' icon.
                // Since we are not a real VMO, we can't use the type icon mechanism directly.
                var classifyIconName = 'typeClassificationElement48.svg';
                imageIconUrl = iconSvc.getTypeIconFileUrl( classifyIconName );
            }

            var lastModifiedDate = classifySvc.getPropertyValue( clsObj.properties, classifySvc.UNCT_MODIFY_DATE );
            if( lastModifiedDate ) {
                lastModifiedDate = classifyUtils.convertClsDateToAWTileDateFormat( lastModifiedDate );
            }
            var vemo = viewModelObjectService.createViewModelObject( clsObj.clsObject.uid );
            vemo.cellHeader1 = currentClassName;
            vemo.cellInternalHeader1 = classId;

            parentIds.push( {
                id: classId,
                className: currentClassName
            } );

            let parentIdsCollection = [];

            _.forEach( parentIds, parentId => {
                let tempParentIdProps = uwPropertyService.createViewModelProperty( 'parentId', 'Parent ID', 'STRING', parentId?.id, parentId?.className  );
                parentIdsCollection.push( tempParentIdProps );
            } );

            vemo.props.parentIds = uwPropertyService.createViewModelProperty( 'parentIds', 'Parent IDs', 'OBJECTARRAY', parentIdsCollection, parentIdsCollection.toString() );

            vemo.typeIconFileUrl = [];

            if( imageIconUrl ) {
                // cell.typeIconFileUrl.push( imageIconUrl );
                vemo.thumbnailURL = imageIconUrl;
                vemo.hasThumbnail = true;
            }
            //add classname in path separately to make it bold on tooltip
            if( lastModifiedDate && parents ) {
                vemo.cellExtendedTooltipProps = classifySvc.getExtendedCellTooltipProps( clsObj, lastModifiedDate, currentClassName, parents );
            }
            vemo.cellExtendedProperties = classifySvc.parseClsProperties( clsObj.properties );
            _.forEach( clsObj.properties, clsProperty => {
                let displayValue = clsProperty.values.length > 0 ? clsProperty.values[0].displayValue : '';
                let internalValue = clsProperty.values.length > 0 ? clsProperty.values[0].internalValue : '';
                vemo.props[clsProperty.propertyId] = uwPropertyService.createViewModelProperty( clsProperty.propertyId, clsProperty.propertyName, 'STRING', internalValue, displayValue );
            } );

            vemo.props.icoUid = uwPropertyService.createViewModelProperty( 'icoUid', 'ICO UID', 'STRING', clsObj.clsObject.uid, clsObj.clsObject.uid.toString() );
            vemo.documents = classDefResponse[ classId ].documents;
            cells.push( vemo );
        } );
    }

    var ctx = appCtxSvc.getCtx( 'clsTabGlobal' );
    if ( !ctx ) {
        var ctx = {};
        ctx.classifyShowImages = true;
        ctx.classifyShowPropGroups = true;
        appCtxSvc.registerCtx( 'clsTabGlobal', ctx );
    }
    return cells;
};


/**
 * Parses the search string before sending to the server.
 *
 * @param {String} searchStr The search string to be parsed.
 *
 * @return {ObjectArray} An object to be used in the SOA request.
 */
export let parseSearchString = function( searchStr ) {
    // Use the common function from classifyService
    return classifySvc.parseSearchString( searchStr );
};

/**
 * Formats the search results for showing them in VNCs.
 *
 * @param {Object} data The search string to be parsed.
 * @param {Object} response  the response from the classification search SOA
 * @param {Object} ctx  Context object from application context
 */
export let formatSearchResultsForVNC = function( data, response, ctx ) {
    var searchResults = exports.formatSearchResults( response );
    // After getting the formatted search results also show the search results in flat VNC hierarchy.
    ctx.currentLevel = {
        children: searchResults
    };
    // This would change initialHierarchy to search VNCs(Useful in case of deselection activity)
    ctx.initialHierarchy = ctx.currentLevel;
    // Remove the cached event data
    if( data.eventData && data.eventData.response ) {
        delete data.eventData.response;
    }
};

/**
 * Private function
 * Appends name to SOA request
 * @param {*} temp vnc tile props
 * @param {*} props properties
 * @param {*} i index
 * @param {*} ctx context
 */
function appendNames( name, props ) {
    var ctx = appCtxSvc.getCtx( 'clsTab' );
    if ( ctx && ctx.releases && ctx.releases.selected  ) {
        var selected = 0;
        _.forEach( ctx.releases.selected, function( release ) {
            if ( release.selected === 'true' ) {
                selected++;
            }
        } );
        if ( selected !== 1 ) {
            var standard = classifySvc.getPropertyValue( props, 'SOURCE_STANDARD' );
            if ( standard && standard !== '' ) {
                var displayName = classifySvc.getReleaseDisplayName( ctx, standard );
                name += ' ( ' + displayName + ' )';
            }
        }
    }
    return name;
}

/**
 * converts the search results into viewmodel properties.
 *
 * @param {Object} response  the response from the classification search SOA
 *
 * @return {ObjectArray} the array of view model properties
 */
export let formatSearchResults = function( response ) {
    var searchResults = [];
    _.forEach( response.clsClassDescriptors,
        function( searchResult ) {
            var className = classifySvc.getPropertyValue( searchResult.properties, classifySvc.UNCT_CLASS_NAME );
            var classId = classifySvc.getPropertyValue( searchResult.properties, classifySvc.UNCT_CLASS_ID );
            var parents = classifySvc.getParentsPath( response.classParents[ classId ].parents );
            className = appendNames( className, searchResult.properties );
            // TBD - Check if getChildren or parseIndividualClassDescription can be used here
            //Icon Handling
            var iconAvailable = false;
            var iconPosition = -1;
            var documents = searchResult.documents;
            var iconindex = 0;
            _.forEach( documents, function( document ) {
                if( document.documentType === 'icon' ) {
                    iconPosition = iconindex;
                }
                iconindex++;
            } );
            var ticket = {};
            if( iconPosition !== -1 ) {
                ticket = searchResult.documents[ iconPosition ].ticket;
            } else {
                // Get the class icon for the ICO's class.
                if( searchResult.documents && searchResult.documents[ 0 ] ) {
                    ticket = searchResult.documents[ 0 ].ticket;
                }
            }
            if( ticket && classifyUtils.isSupportedImageType( ticket ) ) {
                iconAvailable = true;
            }
            var imageIconUrl;
            if( iconAvailable === true ) {
                imageIconUrl = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
                    fmsUtils.getFilenameFromTicket( ticket ) + '?ticket=' + ticket;
            } else {
                // If the class doesn't have an image, then display the 'default' icon.
                // Since we are not a real VMO, we can't use the type icon mechanism directly.
                var classifyIconName = 'typeClassificationElement48.svg';
                imageIconUrl = iconSvc.getTypeIconFileUrl( classifyIconName );
            }

            parents.push( className );
            var tempParentsPath = parents.join( '/' );
            var vmProperty = uwPropertyService.createViewModelProperty( tempParentsPath, className, 'STRING', '',
                '' );
            vmProperty.classData = searchResult;
            vmProperty.classId = classId;
            vmProperty.id = classId;
            vmProperty.className = className;
            vmProperty.typeIconFileUrl = [];
            vmProperty.iconAvailable = iconAvailable;
            vmProperty.classDescription = classifySvc.getPropertyValue( searchResult.properties, classifySvc.UNCT_CLASS_DESCRIPTION );
            //Attach Image Ticket
            if( imageIconUrl ) {
                vmProperty.typeIconFileUrl.push( imageIconUrl );
            }
            searchResults.push( vmProperty );
        } );

    return searchResults;
};

export let resetPropertiesSection = function( data ) {
    // Clear properties related data
    data.attributesVisible = false;
    data.attr_anno = null;
    data.prop_anno = null;
    //set has blocks flag to false, used for Prop Group Tree
    data.hasBlocks = false;
    data.isFiltered = false;
};

export let resetImagesSection = function( data ) {
    // Clear images related data
    data.datasetFilesOutput = null;
    data.clsImgAvailable = false;
    data.totalNoOfImages = 0;
    data.viewerData = null;
    data.index = 0;

    data.viewDataArray = null;
    data.imageURLs = null;
};

/**
 * Resets information related to properties and images section
 *
 * @param {*} data {Object} the declarative viewmodel data
 */
export let resetPropertiesImagesSection = function( data ) {
    exports.resetPropertiesSection( data );
    exports.resetImagesSection( data );
};

export let clearAllProperties = function( data ) {
    try {
        data.clearProperties = true;
        classifySvc.clearAttributes( data );
    } finally {
        data.clearProperties = false;
    }
    classifyFilterUtils.filterProperties( data );
};

/**
 * Displays only the required attributes and hides the other attributes.
 * @param {*} data contains all the attributes that needs to be displayed
 */
export let showMandatoryProperties = function( data ) {
    var ctx = appCtxSvc.getCtx( 'clsTab' );

    ctx.displayOnlyMandatoryAttr = !ctx.displayOnlyMandatoryAttr;
    classifyFilterUtils.filterProperties( data );

    appCtxSvc.updateCtx( 'clsTab', ctx );
};


/*
 * Handles show/hide command
 */
export let clearAllProps = function() {
    eventBus.publish( 'classify.clearAllProps' );
};

/**
 * Displays only the mandatory properties.
 *
 *
 * @function mandatoryFields
 * @memberOf classifyFullViewModeService
 */
export let mandatoryFields = function() {
    eventBus.publish( 'classify.showMandatoryProps' );
};

/*
 * Expands all the attributes when the Expand==>Expand All
 * command is clicked
 *
 * @param {*} data {Object} the declarative viewmodel data
 */
export let expandAll = function( data ) {
    var nodes = data.filteredAttr_anno;
    if( nodes ) {
        expandcollapseAll( nodes, true );
    }else{
        expandcollapseAll( data, true );
    }
};


/*
 * Collapses all the attributes when the Expand==>Collapse All
 * command is clicked
 *
 * @param {*} data {Object} the declarative viewmodel data
 */
export let collapseAll = function( data ) {
    var nodes = data.filteredAttr_anno;
    if( nodes ) {
        expandcollapseAll( nodes, false );
    }else{
        expandcollapseAll( data, false );
    }
};

/*
 * Sets the node.propExpanded to true/false based on whether
 * the expand/collapse command is clicked
 *
 */
export let expandcollapseAll = function( nodes, value ) {
    if( nodes ) {
        if( Array.isArray( nodes ) ) {
            nodes.forEach( function( node ) {
                attributeBlockExpandCollapse( node, value );
            } );
        }else{
            attributeBlockExpandCollapse( nodes, value );
        }
    }
};

/*
 * Expands and collapses the child attributes of the block
 *
 * @param {*} nodes {Object} the existing classes block information
 * @param {*} value {Object} set it to true/false
 */
export let attributeBlockExpandCollapse = function( nodes, value ) {
    nodes.propExpanded = value;
    if( nodes.instances ) {
        expandcollapseAll( nodes.instances, value );
    }
    if( nodes.children ) {
        expandcollapseAll( nodes.children, value );
    }
};

/**
 *  Performs a event call to expandAll
 */
export let expandAllCmd = function() {
    eventBus.publish( 'classify.expandAllCmd' );
};


/**
 *  Performs a event call to collapseAll
 */
export let collapseAllCmd = function() {
    eventBus.publish( 'classify.collapseAllCmd' );
};

/**
 * Code related to AI in classification
 * Loads the suggestedClasses into data.suggestedClasses. Their parents in data.suggestedClassesParents.
 * @param {Object} data  the declarative viewmodel data
 * @param {Object} treeInTab Values to be passed on from tree
 */
export let loadSuggestions = function( data, treeInTab ) {
    if( typeof treeInTab === 'object' && typeof treeInTab.firstLevelResponse === 'object' ) {
        data.suggestedClasses = exports.getSuggestedClasses( treeInTab.firstLevelResponse, data );
        data.suggestedClassesParents = {};

        // For each suggested class, get it's hierarchy and save it in suggestedClassesParents and classInfo.path.
        data.suggestedClasses.forEach( function( classInfo ) {
            data.suggestedClassesParents[ classInfo.id ] = classifySvc.parseClassDescriptions( treeInTab.firstLevelResponse, classInfo.id );
            var parents = [];
            data.suggestedClassesParents[ classInfo.id ].forEach( function( parentItem ) {
                parents.push( parentItem.className );
            } );
            classInfo.classPath = parents.join( ' > ' );
        } );

        // Resetting for handling thumbnail navigation for suggested classes.
        data.suggestedRibbonIncr = 0;
        // Remove the cached first level response
        delete data.treeInTab.firstLevelResponse;
    }
};

/**
 * Suggestions collapsible panel is loaded, now expand it.
 * @param {Object} data  the declarative viewmodel data
 * @param {Object} ctx context where the classification table for the suggested panel section to be expanded is located.
 */
export let initSuggestionsPanel = function( data, ctx ) {
    if( data.suggestedClasses && data.suggestedClasses.length >= 1 ) {
        data.suggestedSectionCollapse = false;
        if( ctx.clsTab ) {
            ctx.clsTab.collapseSuggested = false;
            appCtxSvc.updateCtx( 'clsTab', ctx.clsTab );
        }
    }
};

/**
 * Returns all the suggested classes.
 * @param {Object} response response from the findClassificationInfo SOA
 * @param {Object} data  the declarative viewmodel data
 * @returns {ObjectArray} The array of all suggested class objects
 */
export let getSuggestedClasses = function( response, data ) {
    var suggetedClasses = [];

    if( response && response.clsClassDescriptors ) {
        var existingClassifications = [];
        if( data.icoCells && data.icoCells.constructor === Array ) {
            existingClassifications = data.icoCells.map( function( item ) {
                return item.cellInternalHeader1;
            } );
        }
        _.forEach( response.clsClassDescriptors, function( child ) {
            var classObj = classifySvc.parseIndividualClassDescriptor( child, true );
            if( classObj.id !== 'ICM' && classObj.classProbability >= 1 && existingClassifications.indexOf( classObj.id ) === -1 ) {
                // It's a suggested class only if probability is available and this object is not already classified to this class.
                // While adding do the sorting on classProbability
                var index = suggetedClasses.length - 1;
                for( ; index >= 0; index-- ) {
                    if( suggetedClasses[ index ].classProbability < classObj.classProbability ) {
                        suggetedClasses[ index + 1 ] = suggetedClasses[ index ];
                    } else {
                        break;
                    }
                }
                suggetedClasses[ index + 1 ] = classObj;
            }
        } );
    }
    return suggetedClasses;
};

/**
 * Navigates in the hierarchy-navigation to a suggested class which user has clicked
 * Should show the property preview on navigation
 * @param {Object} data the declarative viewmodel data
 */
export let navigateToSuggestedClass = function( data ) {
    suggestedClassSelected = true;
    data.selectedClass = data.selectedNode;
    data.suggestedClassSelected = true;
    data.suggestedSectionCollapse = true;
    appCtxSvc.ctx.clsTab.collapseSuggested = data.suggestedClassSelected;
    appCtxSvc.ctx.clsTab.parents = _.clone( data.suggestedClassesParents[ data.selectedClass.id ] );
    /**
     * data.treeInTab.performClassExpansion is used to expand the tree upto the toBeExpandedClass using hierarchy given in parentIds
     */
    data.treeInTab = data.treeInTab || {};
    data.treeInTab.performClassExpansion = {
        toBeExpandedClass: data.selectedClass,
        parentIds: appCtxSvc.ctx.clsTab.parents
    };
    eventBus.publish( 'tabGetClassTableSummary.performClassExpansion' );
};

/**
 * Resets the hierarchy within the classification panel back to default
 *
 * @param {Object} data  the declarative viewmodel data
 */
export let resetHierarchy = function( data ) {
    //Reset properties and image section contents
    data.attr_anno = null;
    data.imageURLs = null;
    data.viewerData = null;
    data.clsImgAvailable = false;
    // data.selectedClass = null;

    //set has blocks flag to false, used for Prop Group Tree
    data.hasBlocks = false;
    data.isFiltered = false;

    classifySvc.clearClassBreadCrumb( data );

    // Clear the searchBox
    classifySvc.clearSearchBox( data );
    // Remove the selection from the tree. This should handle all other things.
    data.dataProviders.tabGetClassTableSummary.selectionModel.selectNone();
    data.hierarchyVisible = true;
    data.hierarchyExpanded = true;
    data.attributesVisible = false;
    data.parents = [];
    appCtxSvc.ctx.clsTab.parents = [];
    var ctx = appCtxSvc.getCtx( 'classifyEdit' );
    if( ctx ) {
        ctx.showSave = false;
        appCtxSvc.updateCtx( 'classifyEdit', ctx );
    }
    eventBus.publish( data.tableSummaryDataProviderName + '.dataProvider.reset' );
};

/**
 * When paste is clicked, do update commandContext
 * @param {Object} commandContext commandContext
 * @param {Object} data Declarative view model
 * @param {Object} targetObject Target WSO
 */
export let pasteClicked = function( commandContext, data, targetObject ) {
    //Let's update classify state
    var classifyState = commandContext.classifyState;
    const tmpState = { ...classifyState.value };
    tmpState.pasteClicked = true;
    tmpState.pasteInProgress = true;
    tmpState.targetObject = targetObject;
    commandContext.classifyState.update( tmpState );
    var responseState = commandContext.responseState;
    processPaste( data, classifyState, responseState, targetObject );
};

/**
 * Process findClassificationInfo3 SOA call, fetch attributes information
 * @param {Object} data Declarative view model
 * @param {*} classifyState classify state
 * @param {*} targetObject Target WSO
 * @param {*} classifyStateUpdater Updater method for classifyState
 */
function processPaste( data, classifyState, responseState, targetObject, classifyStateUpdater ) {
    data.selectedClass = null;
    data.hierarchyExpanded = false;
    initialConvertCount = 1;
    data.attr_anno = null;
    data.isFiltered = false;
    data.imageURLs = null;
    data.viewerData = null;
    data.selectedCell = null;
    data.ico = null;
    data.selectedClass = {
        id: targetObject.cellInternalHeader1,
        className: targetObject.cellHeader1,
        type :'StorageClass'
    };
    var icoCells = data.icoCells;
    //find which cell is currently selected, and set selectedCell to it
    _.forEach( icoCells, function( icoCell ) {
        //data.selectedCell = icoCell.selected === true ? icoCell : data.selectedCell;
        if( icoCell.selected === true ) {
            icoCell.selected = false;
        }
    } );
    data.icoCells = icoCells;
    classifyNodeSvc.getAttributesForPaste( data, classifyState, responseState, targetObject, classifyStateUpdater );
}

/* Process edit properties
 *
 * @param {Object} data - view model data
 *
 */
export let processEdit = function( data, panelMode ) {
    var icoEdit = appCtxSvc.getCtx( 'classifyEdit.vmo' );
    //deselect current selection
    var icoCells = data.icoCells;
    var index1 = _.findIndex( icoCells, function( ico ) {
        return ico.cellInternalHeader1 === data.selectedClass.id;
    } );
    if( index1 !== -1 ) {
        icoCells[ index1 ].selected = false;
    }

    //select new selection
    var index2 = _.findIndex( icoCells, function( ico ) {
        return ico.cellInternalHeader1 === icoEdit.cellInternalHeader1;
    } );
    var selectedIco = icoCells[ index2 ];

    //different object selected
    icoCells[ index2 ].selected = true;
    data.icoCells = icoCells;

    data.selectedClass = {
        id: selectedIco.cellInternalHeader1,
        className: selectedIco.cellHeader1
    };
    data.ico = {
        uid: selectedIco.icoUid,
        classID: selectedIco.cellInternalHeader1
    };
    data.selectedCell = selectedIco;
    panelMode.dbValue = 1;
    // TBD - Confirm if it works
    data.attr_anno = null;
    classifyNodeSvc.getAttributes( data );
};

/*
 * Function to retrieve attributes from inputAnnoArray that are editable
 *
 * @param {Object} data  the declarative viewmodel data
 * @param {Array of Objects} annoArray  the input attribute annotation array
 */
export let getEditableAttributes = function( data, annoArray ) {
    _.forEach( annoArray, function( attribute ) {
        var isEditable = exports.isAttributeEditable( data, attribute.id );

        attribute.editable = isEditable;
        attribute.isEditable = isEditable;
        attribute.modifiable = isEditable;

        if( attribute.type === 'Block' ) {
            if( attribute.polymorphicTypeProperty ) {
                uwPropertyService.setIsEditable( attribute.polymorphicTypeProperty.vmps[ 0 ], isEditable );
                if( !attribute.polymorphicTypeProperty.vmps[ 0 ].uiValue ) {
                    attribute.polymorphicTypeProperty.vmps[ 0 ].uiValue = data.i18n.select;
                }
            }
            //If cardinal block
            if( attribute.cardinalController ) {
                exports.getEditableAttributes( data, attribute.children );
                _.forEach( attribute.instances, function( instance ) {
                    exports.getEditableAttributes( data, instance.children );
                    if( instance.polymorphicTypeProperty ) {
                        uwPropertyService.setIsEditable( instance.polymorphicTypeProperty.vmps[ 0 ], isEditable );
                        if( !instance.polymorphicTypeProperty.vmps[ 0 ].uiValue ) {
                            instance.polymorphicTypeProperty.vmps[ 0 ].uiValue = data.i18n.select;
                        }
                    }
                } );
            } else {
                exports.getEditableAttributes( data, attribute.children );
            }
        } else {
            var vmProp = attribute.vmps[ 0 ];
            classifySvc.adjustAttrWidth( vmProp, data.panelMode );
            uwPropertyService.setIsEditable( vmProp, isEditable );
            // Complex Properties
            if ( attribute.vmps.length > NON_COMPLEX_VMO_COUNT ) {
                setComplexEditable( attribute, isEditable );
            }
            if( vmProp.type === 'BOOLEAN' ) {
                vmProp.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
            }
        }
    } );
};

var setComplexEditable = function( attribute, isEditable ) {
    if ( attribute.unitSystem.formatDefinition.formatType >= COMPLEX ) {
        for ( var i = 0; i < attribute.vmps.length; i++ ) {
            if ( i > 2 ) {
                uwPropertyService.setIsEditable( attribute.vmps[ i ], isEditable );
            }
        }
    }
};

/*
 * Function to reset the current state of fullview back to View mode, using cell selection processing
 *
 * @param {Object} data  the declarative viewmodel data
 */
export let resetView = function( data ) {
    classifySvc.setCellProperty( data, data.panelMode );
    classifyViewSvc.processCellSelection( data );
};

/*
 * toggles editMode for selected class
 *
 * @param {Object} data  the declarative viewmodel data
 * @param {String} attributeId  the Id of the attribute to be checked if editable
 * @returns true if attribute is editable
 */
export let isAttributeEditable = function( data, attributeId ) {
    var isAttributeEditable = true;
    var attributesDefinitions = null;
    attributesDefinitions = data.classDefinitionMapResponse[ data.selectedClass.id ].attributes;

    var attrMatched = false;
    _.forEach( attributesDefinitions, function( attribute ) {
        if( !attrMatched && attribute.attributeId === attributeId ) {
            attrMatched = true;
            // If attribute is hidden, read-only, or reference attribute, then don't render it.
            if( ( attribute.options & classifySvc.ATTRIBUTE_HIDDEN ) !== 0 ||
                ( attribute.options & classifySvc.ATTRIBUTE_PROTECTED ) !== 0 ||
                ( attribute.options & classifySvc.ATTRIBUTE_REFERENCE ) !== 0 ||
                ( attribute.options & classifySvc.ATTRIBUTE_FIXED ) !== 0 ||
                ( attribute.options & classifySvc.ATTRIBUTE_FIXED2 ) !== 0 ) {
                isAttributeEditable = false;
            }
        }
    } );

    return isAttributeEditable;
};

/**
 * Checking to see if the selected object is a stand alone object
 *
 * @param {Object} ctx - The application context data
 */
export let isSelectedObjectStandAlone = function( ctx ) {
    var clsLocation = appCtxSvc.getCtx( 'clsLocation' );
    if ( clsLocation ) {
        if( ctx && ctx.selected && ctx.selected.modelType && ctx.selected.modelType.typeHierarchyArray
            && ( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Cls0Object' ) > -1 || ctx.selected.modelType.typeHierarchyArray.indexOf( 'Cls0CstObject' ) > -1 ) ) {
            clsLocation.isSelectedObjectStandAlone = true;
        }else {
            clsLocation.isSelectedObjectStandAlone = false;
        }
    }
};

/**
 * Formats the classification class Image attachments so that they can be displayed in the UI.
 *
 * @param {Object} data - The view-model data object
 */
export let formatImageAttachments = function( data ) {
    if( appCtxSvc.ctx &&  appCtxSvc.ctx.locationContext && appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:Location' ] === 'com.siemens.splm.classificationManagerLocation' ) {
        data.datasetFilesOutput = appCtxSvc.ctx.clsAdmin.datasetFilesOutput;
    }
    var imageURLs = [];
    var totalNoOfImages = 0;
    var index = 0;
    var viewDataArray = [];
    var imageIndex = 0;
    if( data.datasetFilesOutput && data.datasetFilesOutput.length > 0 && data.datasetFilesOutput[ 0 ] ) {
        _.forEach( data.datasetFilesOutput, function( dsOutputArrElement ) {
            var hasMoreImage = false;
            if( data.datasetFilesOutput.length > 1 ) {
                hasMoreImage = true;
            }
            var ticket = dsOutputArrElement.ticket;
            var isSupportedImgtype = false;
            //  getting correct viewer for various format of supported images and pdf
            if( ticket && ticket.length > 28 ) {
                var n = ticket.lastIndexOf( '.' );
                var ticketExt = ticket.substring( n + 1 ).toUpperCase();
                if( [ 'GIF', 'JPG', 'JPEG', 'PNG', 'BMP', 'SVG' ].indexOf( ticketExt ) > -1 ) {
                    var viewer = 'Awp0ImageViewer';
                    isSupportedImgtype = true;
                } else if( ticketExt === 'PDF' ) {
                    viewer = 'Awp0PDFViewer';
                    isSupportedImgtype = true;
                }
            }
            if( isSupportedImgtype ) {
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
        } );
    }
    data.totalNoOfImages = totalNoOfImages;
    //Set initial image to be selected in ribbon
    if( viewDataArray[ index ] ) {
        viewDataArray[ index ].selected = true;
    }
    data.ribbonIncr = 0;
    data.viewerData = viewDataArray[ index ];
    data.index = index;
    data.viewDataArray = viewDataArray;
    data.imageURLs = imageURLs;
};

/**
 * Sets the unit system state on the panel.
 *
 * @param {Object} data - The viewmodel data object
 */
export let setUnitSystem = function( data ) {
    var unitSystemEnabled;

    var clsLocation = appCtxSvc.getCtx( 'clsLocation' );
    if( clsLocation !== undefined && clsLocation.showStandalone === true ) {
        data.panelMode = 0;
        data.unitSystem = {};
    }

    if( data.panelMode === 0 && !data.standaloneObjectExists || data.panelMode === 1 && data.editClassInProgress ) {
        var classUnitSystem;
        if( data.classDefinitionMapResponse ) {
            classUnitSystem = classifySvc.getPropertyValue(
                data.classDefinitionMapResponse[ data.selectedClass.id ].properties, classifySvc.UNCT_CLASS_UNIT_SYSTEM );

            data.unitSystem.dbValue = classUnitSystem === 'metric' || classUnitSystem === 'both';
            unitSystemEnabled = classUnitSystem === 'both';

            data.unitSystem.isEditable = unitSystemEnabled;
            data.unitSystem.isEnabled = unitSystemEnabled;
        }
    } else if( ( data.panelMode === -1 || data.standaloneObjectExists && !data.createForStandalone ) &&
        data.clsObjInfo || data.panelMode === 1 && data.pasteIsClicked === true ) {
        var icoUnitSystem = classifySvc.getPropertyValue( data.clsObjInfo.properties, classifySvc.UNCT_CLASS_UNIT_SYSTEM );
        data.unitSystem.dbValue = icoUnitSystem === 'metric' || icoUnitSystem === 'UNSPECIFIED';
        if( data.classDefinitionMapResponse ) {
            unitSystemEnabled = classifySvc.getPropertyValue(
                data.classDefinitionMapResponse[ data.selectedClass.id ].properties, classifySvc.UNCT_CLASS_UNIT_SYSTEM ) === 'both';
        }
        data.unitSystem.isEditable = unitSystemEnabled;
        data.unitSystem.isEnabled = unitSystemEnabled;
    }
};

/**
 * @deprecated Use from classifyNodeService
 * Formats the classification attributes so they can be displayed in the ui.
 *
 * @param {Object} data - The viewmodel data object
 */
export let formatAttributes = function( data ) {
    var ctxClsTab = appCtxSvc.getCtx( 'clsTab' );
    ctxClsTab.displayOnlyMandatoryAttr = undefined;
    appCtxSvc.updateCtx( 'clsTab', ctxClsTab );


    exports.setUnitSystem( data );


    //Set the visibility of panel sections;
    data.hierarchyVisible = true;
    data.attributesVisible = true;
    var attributesDefinitions = null;

    //Format the attributes for display
    if( data.classDefinitionMapResponse ) {
        attributesDefinitions = data.classDefinitionMapResponse[ data.selectedClass.id ].attributes;
        data.classesProperties = data.classDefinitionMapResponse[ data.selectedClass.id ].properties;
        appCtxSvc.ctx.classesProperties = [];
        _.forEach( classifySvc.UNCT_CLASS_ATTRIBUTES, function( key ) {
            var value = classifySvc.getPropertyValue(
                data.classesProperties, key );
            var vmoProp = uwPropertyService.createViewModelProperty( key, key, '', value.toString(), value.toString() );
            vmoProp.uiValue = value.toString();
            appCtxSvc.ctx.classesProperties.push( vmoProp );
        } );
    }
    data.attr_anno = [];
    data.prop_anno = [];

    var valuesMap = null;
    if( data.clsObjInfo && data.ico ) {
        valuesMap = classifyUtils.getClsUtilValueMap( data, data.selectedClass.id, data.clsObjInfo.properties, data.clsObjInfo.blockDataMap );
    } else if( data.clsObjInfo && suggestedClassSelected === true ) {
        suggestedClassSelected = false;
        initialConvertCount = 1;
        valuesMap = classifyUtils.getClsUtilValueMap( data, data.selectedClass.id, data.clsObjInfo.properties, data.clsObjInfo.blockDataMap );
    } else if( data.panelMode === 0 && typeof data.localPropertyValues === 'object' && !data.clearProperties ) {
        initialConvertCount = 1;
        valuesMap = classifyUtils.getClsUtilValueMap( data, data.selectedClass.id, data.localPropertyValues.properties, data.localPropertyValues.blockDataMap );
    }

    if( data.panelMode === 1 && data.selectedCell ) {
        initialConvertCount = 1;
    }
    if( attributesDefinitions ) {
        classifySvc.formatAttributeArray( data, null, attributesDefinitions, valuesMap, data.attr_anno, '', false, false, null, null, data.clearProperties );


        //if "Classication Object" command is clicked then an additional ID field needs to be added
        //in the SWA along with teh other attributes.
        var standAlone = appCtxSvc.getCtx( 'clsLocation' );
        if( standAlone !== undefined && standAlone.showStandalone === true ) {
            var id = buildStandaloneIDField( data );
            data.attr_anno.unshift( id[0] );
        }
    }
    if( data.selectedCell ) {
        //update cell extended Props for selected class
        updateCellProps( data.selectedCell.cellExtendedTooltipProps, valuesMap );
    }
    //handle any filter from preview
    classifyFilterUtils.filterProperties( data );
    classifyViewSvc.populatePropertyGroupTree( data.attr_anno );
    data.filteredPropGroups = data.attr_anno;

    //Update context for command visibility
    var ctx = appCtxSvc.getCtx( 'clsTab' );
    ctx.mandatoryFieldsExists = false;
    ctx.classifyShowMetric  = data.unitSystem.dbValue;
    ctx.classifyUnitsEnabled = data.unitSystem.isEnabled;

    if ( ctx.classifyShowAnnotations === undefined ) {
        ctx.classifyShowAnnotations = data.selectedClass.hasAnno;
    }
    ctx.classifyHasAnnotations = data.selectedClass.hasAnno;
    ctx.classifyHasPropGroups = data.hasBlocks;

    //mandatory command appears only when the class contains
    //required attributes.
    var numberOfAttributes = data.attr_anno.length;
    for( var i = 0; i < numberOfAttributes; i++ ) {
        if( data.attr_anno[i].vmps && data.attr_anno[i].vmps[0].isRequired !== undefined &&
                data.attr_anno[i].vmps[0].isRequired === true ) {
            ctx.mandatoryFieldsExists = true;
            break;
        }else if( data.attr_anno[i].suffix &&
                        data.attr_anno[i].suffix === '*' ) {
            ctx.mandatoryFieldsExists = true;
            break;
        }
    }
    ctx.classifyHasAnnotations = data.selectedClass.hasAnno;
    ctx.classifyHasPropGroups = data.hasBlocks;

    //mandatory command appears only when the class contains
    //required attributes.
    for( var i = 0; i < numberOfAttributes; i++ ) {
        if( data.attr_anno[i].vmps && data.attr_anno[i].vmps[0].isRequired !== undefined &&
                data.attr_anno[i].vmps[0].isRequired === true ) {
            ctx.mandatoryFieldsExists = true;
            break;
        }else if( data.attr_anno[i].suffix &&
                        data.attr_anno[i].suffix === '*' ) {
            ctx.mandatoryFieldsExists = true;
            break;
        }
    }
    ctx.numberOfAttributes = numberOfAttributes;
    ctx.classifyShowImageCmd = data.clsImgAvailable;
    appCtxSvc.updateCtx( 'clsTab', ctx );
    return data;
};


export let getUnitsAndConvert = async function( data ) {
    if( data.attr_anno ) {
        var request = {
            valueConversionInputs: []
        };
        _.forEach( data.attr_anno, function( attribute ) {
            request.valueConversionInputs.push( exports.convertAttr( data, attribute ) );
        } );
        var realRequest = {
            valueConversionInputs: []
        };
        var indexes = [];
        for( var u = 0; u < request.valueConversionInputs.length; u++ ) {
            if( request.valueConversionInputs[ u ].inputUnit !== '' ) {
                indexes.push( u );
                realRequest.valueConversionInputs.push( request.valueConversionInputs[ u ] );
            }
        }
        if( realRequest && realRequest.valueConversionInputs ) {
            let response = await exports.convertValues2( realRequest );
            //.then( function( response ) {
            if( response && !response.partialErrors && response.convertedValues ) {
                var i = 0;
                _.forEach( indexes, function( item ) {
                    var attr = data.attr_anno[ item ];
                    var values = response.convertedValues[ i ].convertedValues[ 0 ];
                    i++;
                    if( values !== '' && values > 0 ) {
                        attr.vmps[ 0 ].dbValue = values;
                        attr.vmps[ 0 ].dbValues[ 0 ] = values;
                        attr.vmps[ 0 ].displayValue = values;
                        attr.vmps[ 0 ].valueUpdated = values;
                    }
                } );
            }
        }
    }
};

export let convertValues2 = async function( request ) {
    return await soaService.postUnchecked( 'Classification-2016-03-Classification', 'convertValues', request );
};

export let convertAttr = function( data, attribute ) {
    try {
        if( attribute.unitSystem.startValue ) { // && attribute.unitSystem.startValue !== attribute.unitSystem.unitName ) {
            var tempAttrId = attribute.id;
            var tempAttrPrefix = attribute.prefix;
            var isCstAttr = Boolean( tempAttrId.substring( 0, 4 ) === 'cst0' || tempAttrPrefix.substring( 0, 4 ) === 'cst0' );
            if( attribute.type !== 'Block' && !attribute.isCardinalControl ) {
                var vmo = attribute.vmps[ 0 ];
                var input = {
                    inputValues: [],
                    options: 0
                };
                if( vmo.dbValues ) {
                    if( _.isArray( vmo.dbValues[ 0 ] ) ) {
                        _.forEach( vmo.dbValues[ 0 ], function( value ) {
                            input.inputValues.push( value.toString() );
                        } );
                    } else {
                        input.inputValues.push( vmo.dbValues[ 0 ].toString() );
                    }
                    var unitSystem;
                    //By this point, unitSystem represents the new/desired unit system.
                    if( !data.unitSystem.dbValue ) {
                        unitSystem = vmo.nonMetricFormat;
                    } else {
                        unitSystem = vmo.metricFormat;
                    }
                    input.inputUnit = attribute.vmps[ 2 ].uiValue;
                    //Replace unitsystem and values with new values
                    attribute.attrDefn.updateViewPropForUnitSystem( data, attribute, unitSystem, isCstAttr );
                    input.outputFormat = unitSystem.formatDefinition;
                    input.outputUnit = attribute.unitSystem.startValue;
                } else {
                    input.inputValues = [];
                    input.inputValues.push( '' );
                    input.inputUnit = '';
                    //Replace unitsystem and values with new values
                    input.outputFormat = {
                        formatLength: 80,
                        formatModifier1: 0,
                        formatModifier2: 0,
                        formatType: 0
                    };
                    input.outputUnit = '';
                }
                return input;
            } else if( attribute.type === 'Block' ) {
                // Defect NoBlockHandling
                // We need to handle cardinal instances here as well, which will add more code
            }
        } else {
            var vmo = attribute.vmps[ 0 ];
            var input2 = {
                inputValues: [],
                options: 0
            };
            input2.inputValues = [];
            input2.inputValues.push( '' );
            input2.inputUnit = '';
            //Replace unitsystem and values with new values
            input2.outputFormat = {
                formatLength: 80,
                formatModifier1: 0,
                formatModifier2: 0,
                formatType: 0
            };
            input2.outputUnit = '';
            return input2;
        }
    } catch ( err ) {
        console.error( err );
    }
};

/*
 * Compiles the classification properties and their values to be sent in the classify operation.
 *
 * @param {Object} data - the viewmodel data for this panel
 * @returns class properties
 */
export let getClassProperties = function( data ) {
    var properties = [];
    var standAloneICOProperty = [];
    var clsLocation = appCtxSvc.getCtx( 'clsLocation' );

    //data.attr_anno = exports.getHiddenConversionValues( data );
    var valuesMap = classifyUtils.getClsUtilValueMap( data, data.selectedClass.id, null, null, data.attr_anno );
    if( valuesMap ) {
        properties = valuesMap.properties;

        var icoId = null;
        // Classification object id

        icoId = data.ico ? data.ico.uid : '';


        //if standalone is true do not create ICO entry as
        // it is already created
        if( clsLocation === undefined ||  clsLocation && !clsLocation.showStandalone  ) {
            properties.push( {
                propertyId: classifySvc.UNCT_ICO_UID,
                propertyName: '',
                values: [ {
                    internalValue: icoId,
                    displayValue: icoId
                } ]
            } );
        }else {
            //shifting ICO_ID entry from the first to the last
            //when standAlone ICO is true.
            standAloneICOProperty = properties.shift();
            properties.push( standAloneICOProperty );
        }

        // Classification class id
        properties.push( {
            propertyId: classifySvc.UNCT_CLASS_ID,
            propertyName: '',
            values: [ {
                internalValue: data.selectedClass.id,
                displayValue: data.selectedClass.id
            } ]
        } );

        // ICO unit system
        var currentUnitSystem = data.unitSystem.dbValue ? '0' : '1';
        properties.push( {
            propertyId: classifySvc.UNCT_CLASS_UNIT_SYSTEM,
            propertyName: '',
            values: [ {
                internalValue: currentUnitSystem,
                displayValue: currentUnitSystem
            } ]
        } );

        // Push a special property to indicate the standalone needs to be connected.
        // Now, if the user has chosen to create a new classification( instead of connecting to existing),
        // then we don't not need to set this property.
        if( data.standaloneObjectExists && data.standaloneObjectExists === true && !data.createForStandalone ) {
            properties.push( {
                // Currently using this 'nowhere defined' value for ICS_CONNECT_STANDALONE property.
                // We need a better mechanism than this to send it to SOA though
                propertyId: classifySvc.ICS_CONNECT_STANDALONE,
                propertyName: '',
                values: [ {
                    internalValue: 'true',
                    displayValue: 'true'
                } ]
            } );
        }
        var ctx = appCtxSvc.getCtx( 'classifyTableView' );
        if( ctx && ctx.attribute && ctx.attribute.tableView ) {
            ctx.noReload = true;
            appCtxSvc.updateCtx( 'classifyTableView', ctx );
        }
        return properties;
    }
};

/**
 * Update the selected class with the currently selected class in tree
 * detectNodeType gets called with ctx.clsTab.selectedTreeNode. So may be there won't be any need for calling this function intermediately as data.selectedClass gets assigned as well
 * @param {Object} data the declarative viewmodel data
 * @param {Object} ctx the declarative viewmodel data
 */
export let updateSelectedClassFromTree = function( data, ctx ) {
    if( ctx.clsTab.selectedTreeNode !== null && ctx.clsTab.selectedTreeNode.displayName !== undefined ) {
        ctx.clsTab.selectedTreeNode.className = ctx.clsTab.selectedTreeNode.displayName;
    }
    data.selectedClass = ctx.clsTab.selectedTreeNode;
    return data;
};

/**
 * Method to divide up the two types of templates into separate arrays.
 *
 * @param {Array} templates - Information about the various templates available to a given classification.
 */
export let divideTemplateTypes = function( templates ) {
    var result = {};
    result.partFamilyTemplates = [];
    result.templatePartTemplates = [];
    _.forEach( templates, function( template ) {
        if( template.templateType === 'ICS_part_family_template' ) {
            result.partFamilyTemplates.push( template );
        } else {
            result.templatePartTemplates.push( template );
        }
    } );
    return result;
};

/**
 * Method to organize empty properties for display in a table in graphics builder panel.
 *
 * @param {Array} emptyProperties - The properties which have not been filled out for the given class before the template is created.
 */
export let createGraphicsBuilderTableProps = function( emptyProperties ) {
    var result = [];
    _.forEach( emptyProperties, function( emptyProp ) {
        var emptyPropTableRow = {
            props: {
                id: {
                    uiValue: emptyProp.propertyIdentifier,
                    value: emptyProp.propertyIdentifier
                },
                annotation: {
                    uiValue: emptyProp.propertyAnnotation,
                    value: emptyProp.propertyAnnotation
                },
                name: {
                    uiValue: emptyProp.propertyName,
                    value: emptyProp.propertyName
                }
            }
        };
        result.push( emptyPropTableRow );
    } );
    return result;
};


export let noAction = function( data ) {
    // no action right now. May be filled if required.
};


/**
 * Method to create a checkbox dynamically. Can be used to make a new checkbox or to refresh an existing one in data.
 * Populate outputData of the viewmodel with the name of the checkbox to be created or refreshed.
 *
 * @param {Object} checkboxData - The checkboxData. Can contain any traits used by aw-checkbox, such as isRequired,
 */
export let setCheckboxFalse = function( checkboxData ) {
    checkboxData.dbValue = false;
    return checkboxData;
};

/**
 * Display previous image if there are multiple images
 *
 * @param {Object} data - the viewmodel data object
 */
export let onPrevChevronClick = function( data ) {
    eventBus.publish( 'classify.prevChevronClick' );
};

/**
 * Display Next image if there are multiple images
 *
 * @param {Object} data - the viewmodel data object
 */
export let onNextChevronClick = function( data ) {
    eventBus.publish( 'classify.nextChevronClick' );
};

/**
 * Display previous image if there are multiple images in circular way
 *
 * @param {Object} data - the viewmodel data object
 */
export let onCircularPrevChevronClick = function( data ) {
    data.suggestedRibbonIncr = Math.abs( ( data.suggestedRibbonIncr - 1 ) % data.suggestedClasses.length );
    var element = document.getElementById( 'marginLast' );
    if( data.suggestedClasses.length === 1 ) {
        element.style.marginLeft = '37%';
    } else {
        element.style.marginLeft = '0px';
    }

    data.suggestedRight = data.suggestedRibbonIncr * 21;
    element = document.getElementById( 'marginFirst' );
    element.style.marginLeft = '-' + data.suggestedRight + '%';
};


/**
 * Display Next image if there are multiple images in circular way
 *
 * @param {Object} data - the viewmodel data object
 */
export let onCircularNextChevronClick = function( data ) {
    data.suggestedRibbonIncr = Math.abs( ( data.suggestedRibbonIncr + 1 ) % data.suggestedClasses.length );
    data.suggestedRight = data.suggestedRibbonIncr * 21;
    var element = document.getElementById( 'marginFirst' );
    element.style.marginLeft = '-' + data.suggestedRight + '%';
};


/**
 * Sets all property groups, and their children, to be not selected.
 *
 * @param {ObjectArray} propertyGroupArray - property group array
 */
export let resetPropertyGroupSelection = function( propertyGroupArray ) {
    _.forEach( propertyGroupArray, function( propertyGroup ) {
        if( propertyGroup.type === 'Block' ) {
            propertyGroup.selected = false;
            if( propertyGroup.instances && propertyGroup.instances.length > 0 ) {
                exports.resetPropertyGroupSelection( propertyGroup.instances );
            } else if( propertyGroup.children && propertyGroup.children.length > 0 ) {
                exports.resetPropertyGroupSelection( propertyGroup.children );
            }
        }
    } );
};

/**
 * Sets is filtered to false, effectively causing the properties panel to note render the filtered attributes.
 * Also resets Property Group selection.
 *
 * @param {Object} data - the viewmodel data object
 */
export let resetAttributeFilter = function( data ) {
    data.isFiltered = false;
    exports.resetPropertyGroupSelection( data.attr_anno );
};


/**
 * Splits search terms
 *
 * @param {String} text - keyword text
 * @return {Array}Returns array of split keywords
 */
function getSearchTerms( text ) {
    var _text = text;
    if( _text.indexOf( '*' ) > -1 ) {
        _text = _text.replace( /[*]/gi, ' ' );
    }
    // split search text on space
    return _text.split( ' ' );
}

/**
 * Highlight Keywords
 *
 * @param {Object} data search terms to highlight
 */
export let highlightKeywords = function( data ) {
    //Commenting out the highlighter code because it is not being used to highlight the classes
    /*if( data.propFilter === undefined || data.propFilter === '' || data.propFilter.trim() === '*' ) {
        appCtxSvc.ctx.clsTab.highlighter = undefined;
    } else {
        var searchTerms = getSearchTerms( data.propFilter );
        highlighterSvc.highlightKeywords( searchTerms );
    }*/
};

/*
 * Adds an item to the set if not available
 * @param items set of items
 * @param item item to add
 */
export let addItems = function( items, item ) {
    //search if item already exists in array
    var itemindex = _.findIndex( items, {
        name: item.name
    } );

    if( itemindex >= 0 ) {
        items.splice( itemindex, 1 );
    }
    items.push( item );
};


/**
 *
 * @param {Object} data Declartive view model
 * @param {Object} eventData  eventData
 */
export let propertyFilter = function( data ) {
    appCtxSvc.ctx.attributeProperties = [];

    if( data.eventData  === null ) {
        data.isFiltered = false;
    } else {
        data.isFiltered = true;
        data.filteredAttributes = [];
        data.filteredAttributes.push( data.eventData );
        data.nodeAttr = data.filteredAttributes;
        //When selecting a node, expand it automatically
        data.nodeAttr[ 0 ].propExpanded = true;
        if( data.propFilter.dbValue ) {
            classifyFilterUtils.filterProperties( data, true );
        }
    }
};


/*
 * Update cardinal blocks with new instances
 *
 * @param {Object} data - view model data
 * @param {Object} cardinalBlockAttr - cardinal block attribute
 *
 * @returns list of items that matched the term
 */
export let updateCardinalBlocks = function( data, cardinalBlockAttr ) {
    if( !data.origAttr_anno ) {
        data.origAttr_anno = data.attr_anno;
    } else {
        //find cardinal attr and update instances
        var index = _.findIndex( data.origAttr_anno, function( attr ) {
            return cardinalBlockAttr.name === attr.name;
        } );
        if( index > -1 ) {
            data.origAttr_anno[ index ].instances = cardinalBlockAttr.instances;
        }
    }
    if( cardinalBlockAttr.tableView ) {
        classifyTblSvc.updateInstanceData( data, cardinalBlockAttr );
        classifyTblSvc.updateTableData( data, cardinalBlockAttr );
    } else {
        //check if any other block is in table view and copy instance data
        var ctx = appCtxSvc.getCtx( 'classifyTableView' );
        if( ctx && ctx.attribute && ctx.attribute.tableView ) {
            classifyTblSvc.updateInstanceData( data, ctx.attribute );
        }
    }
    if( data.propGroupFilter.dbValue ) {
        classifyFilterUtils.filterPropGroups( data );
    }
    classifyFilterUtils.filterProperties( data );
    classifyViewSvc.populatePropertyGroupTree( data.attr_anno );
};


/**
 *  TODO: Check if needed for BA.
 *
 * Deselect the ICO(if any) before entering the editClass mode.
 * @param {Object} data - view model data
 */
export let deselectICOBeforeEditing = function( data ) {
    appCtxSvc.ctx.clsTab.navigateToEditClass = true;
    if( data && data.dataProviders && data.dataProviders.performSearch && data.dataProviders.performSearch.selectedObjects.length <= 0 ) {
        /**
         * If there is no selection then performSearch.selectionChangeEvent is not fired. Thus publish another event.
         */
        eventBus.publish( 'classifyTab.checkIfEditsToBeCancelled' );
    } else {
        // Deselect the ICO
        data.dataProviders.performSearch.selectNone();
    }
};

/*
 * Handles show/hide images command
 */
export let showImagesMaximized = function( context ) {
    var ctx = appCtxSvc.getCtx( 'clsTab' );
    ctx.classifyImageMaximize  = !ctx.classifyImageMaximize;
    appCtxSvc.updateCtx( 'clsTab', ctx );
};

/*
Reset the goToView once it's use is completed by saveEdits
*/
export let resetEventMapForPropValidation = function( data ) {
    if( data.eventMap && data.eventMap[ 'classifyPanel.propValidation' ] && data.eventMap[ 'classifyPanel.propValidation' ].goToView === false ) {
        delete data.eventMap[ 'classifyPanel.propValidation' ].goToView;
    }
    return data;
};

/*
 * Handles copy/paste table column command
 */
export let copyTableColumn = function( context, data ) {
    //TBD
};

/*
 * Handles show/hide command
 */
export let toggleTableView = function( context, data ) {
    var ctx = {
        attribute: context.attribute
    };
    eventBus.publish( 'classify.toggleTableView', ctx );
};

/**
 * Checks if value is required, is valid keyLOV or if in min-max range
 * @param {Object} data - view model data
 * @param {Object} node - current Block class
 * @param {Object} isRequiredAttrsArray - collection of mandatory attributes
 * @param {Boolean} isPoly - true if polymorphic node, false otherwise
 * @return {Object} returns flags to indicate validity
 */
// eslint-disable-next-line complexity
export let checkValidValue = function( data, node, isRequiredAttrsArray, isPoly ) {
    var isValidData = {};
    var validToSave = false;
    if( typeof node.vmps[ '0' ].dbValue !== 'undefined' ) {
        if( node.vmps[ '0' ].isRequired === true ) {
            isRequiredAttrsArray.push( node );

            if( node.vmps[ '0' ].dbValue !== null && node.vmps[ '0' ].dbValue.length !== 0 && node.vmps[ '0' ].dateApi.dateValue !== '' ) {
                validToSave = true;
            }
            if( isPoly && !node.vmps[ 0 ].dbValue ) {
                node.vmps[ 0 ].propertyRequiredText = 'Required';
                node.vmps[ 0 ].uiValue = '';
            }
        } else {
            if ( node.unitSystem && node.unitSystem.formatDefinition && node.unitSystem.formatDefinition.formatType >= COMPLEX ) {
                var complexValid = true;
                if ( node.vmps[0].error !== null && node.vmps[0].error.length > 0 ) {
                    complexValid = false;
                }
                if ( node.vmps[3].error !== null && node.vmps[3].error.length > 0 ) {
                    complexValid = false;
                }
                // Tolerance, Level, Position, Axis
                if (   node.unitSystem.formatDefinition.formatType > 5 ) {
                    if ( node.vmps[4].error !== null && node.vmps[4].error.length > 0 ) {
                        complexValid = false;
                    }
                    // Level
                    if (   node.unitSystem.formatDefinition.formatType === 7 ) {
                        if ( node.vmps[5].error !== null && node.vmps[5].error.length > 0 ) {
                            complexValid = false;
                        }
                    } else if (   node.unitSystem.formatDefinition.formatType === 9 ) {
                        // Axis
                        if ( node.vmps[6].error !== null && node.vmps[6].error.length > 0 ) {
                            complexValid = false;
                        }
                        if ( node.vmps[7].error !== null && node.vmps[7].error.length > 0 ) {
                            complexValid = false;
                        }
                    }
                }
                validToSave = complexValid;
            } else {
                validToSave = true;
            }
        }
        isValidData = classifySvc.isSingleKeyLOVvalid( node, data );
        if ( node.unitSystem && node.unitSystem.formatDefinition && node.unitSystem.formatDefinition.formatType >= COMPLEX ) {
            isValidData = exports.validateComplexFields( node, isValidData );
        }
        classifySvc.isAttributeValueInRange( node, isValidData );
        //check if cardinality is valid integer for cardinal blocks
        isValidData.isValidValue = true;
        if( node.isCardinalControl ) {
            var value = parseInt( node.vmps[ 0 ].dbValue );
            if( value < 0 ) {
                isValidData.isValidValue = false;
                isValidData.invalidAttr = node.name;
            }
        }
        validToSave = validToSave && classifySvc.checkValid( isValidData );
    }
    isValidData.isValidtoSave = validToSave;
    return isValidData;
};

/*
 * Checks complex data for errors and unfilled fields.
 * @param {Object} node - current Block class
 * @param {Object} isValidData - current valid data object
*/
// eslint-disable-next-line complexity
export let validateComplexFields = function( node, isValidData ) {
    var isValidtoSave = true;
    var isAllComplexFilled = true;
    if ( node.unitSystem.formatDefinition.formatType > LOWEST_NON_COMPLEX_TYPE && node.unitSystem.formatDefinition.formatType < COMPLEX_POSITION ) { // Tolerance, Range, Level
        var emptyCount = 0;
        for ( var vmo = 0; vmo < node.vmps.length; vmo++ ) { //check for empty fields
            if (  vmo !== 1 && vmo !== 2 && ( node.vmps[vmo].dbValue === '' || node.vmps[vmo].dbValue === null ) ) {
                emptyCount++;
            }
        }
        var skippedVMOCount = 2;
        if ( emptyCount > 0 && emptyCount + skippedVMOCount !== node.vmps.length ) {
            isValidData.isAllComplexFilled = false;
            isValidtoSave = false;
            isValidData.invalidComplexAttr = node.vmps[0].propertyDisplayName;
        } else {
            isAllComplexFilled = true;
        }
        if ( emptyCount + 2 === node.vmps.length ) {
            return isValidData;
        }
        if ( isValidtoSave ) { //Check Minimum is less than maximum
            if ( node.unitSystem.formatDefinition.formatType === 5 && parseFloat( node.vmps[0].dbValue ) > parseFloat( node.vmps[3].dbValue ) ) { // Range
                isValidtoSave = false;
                isValidData.isValidMinMax = false;
                isValidData.invalidComplexAttr = node.vmps[0].propertyDisplayName;
            } else if ( node.unitSystem.formatDefinition.formatType === 6 && parseFloat( node.vmps[3].dbValue ) > parseFloat( node.vmps[4].dbValue ) ) { // Tolerance
                isValidtoSave = false;
                isValidData.isValidMinMax = false;
                isValidData.invalidComplexAttr = node.vmps[0].propertyDisplayName;
            } else if ( node.unitSystem.formatDefinition.formatType === 7 && parseFloat( node.vmps[4].dbValue ) > parseFloat( node.vmps[5].dbValue ) ) { // Level
                isValidtoSave = false;
                isValidData.isValidMinMax = false;
                isValidData.invalidComplexAttr = node.vmps[0].propertyDisplayName;
            }
            // Check Tolerance/Nominal
            if ( isAllComplexFilled === true && node.unitSystem.formatDefinition.formatType === 6 ) { //Tolerance
                var nominal = parseFloat( node.vmps[0].dbValue );
                var minimum = parseFloat( node.vmps[3].dbValue );
                var maximum = parseFloat( node.vmps[4].dbValue );
                if ( nominal < minimum || nominal > maximum ) {
                    isValidData.isValidNominal = false;
                    isValidtoSave = false;
                    isValidData.invalidComplexAttr = node.vmps[0].propertyDisplayName;
                }
            } else if ( isAllComplexFilled === true && node.unitSystem.formatDefinition.formatType === 7 ) { //Level
                var nominal = parseFloat( node.vmps[0].dbValue );
                var typical = parseFloat( node.vmps[3].dbValue );
                var minimum = parseFloat( node.vmps[4].dbValue );
                var maximum = parseFloat( node.vmps[5].dbValue );
                if ( nominal < minimum || nominal > maximum || typical < minimum || typical > maximum ) {
                    isValidData.isValidNominal = false;
                    isValidtoSave = false;
                    isValidData.invalidComplexAttr = node.vmps[0].propertyDisplayName;
                }
            }
        }
    } else if ( node.unitSystem.formatDefinition.formatType > 7 ) { // Position, Axis
        // No field checking needed, empty fields save as zero.
        isValidtoSave = true;
    }
    return isValidData;
};

/**
 * Validates cardinal controller
 *
 * @param {*} node node to validate
 * @param {*} cardinalValue given value
 * @param {*} maxInstances max value
 * @returns {*} result
 */
let validateCardinality = function( node, cardinalValue, maxInstances ) {
    var isValidData = {
        isValidtoSave: true,
        isCountValid: true,
        isCountMatch: true
    };
    //if cardinalValue > max allowed, error
    if ( maxInstances !== -1 && cardinalValue > 0 && cardinalValue > maxInstances ) {
        isValidData.isValidtoSave = false;
        isValidData.isCountValid = false;
        isValidData.invalidCount = maxInstances;
        isValidData.nodeName = node.name;
    }
    //check if the number of instances match the cardinal value
    if ( cardinalValue !== node.instances.length && cardinalValue < node.instances.length ) {
        isValidData.isValidtoSave = false;
        isValidData.isCountValid = false;
        isValidData.invalidCount = cardinalValue;
        isValidData.isCountMatch = false;
        isValidData.nodeName = node.name;
    }
    return isValidData;
};

/*
 * Get mandatory Block type attributes data
 * @param {Object} node - current Block class
 * @param {Object} isRequiredAttrsArray - collection of mandatory attributes
 * @param {Object} data - view model data
 * @param {Boolean} isPoly - true if polymorphic node, false otherwise
 *
 */
export let validateProps = function( node, isRequiredAttrsArray, data, isPoly ) {
    var isValidData = {
        isValidtoSave: true,
        isCountValid: true
    };
    if( node.type !== 'Block' ) {
        return exports.checkValidValue( data, node, isRequiredAttrsArray, isPoly );
    }
    //If poly but not cardinal
    if( node.polymorphicTypeProperty && !node.cardinalController ) {
        isValidData = exports.validateProps( node.polymorphicTypeProperty, isRequiredAttrsArray, data, true );
        if( !isValidData.isValidtoSave ) {
            return isValidData;
        }
    }
    if( node.cardinalController ) {
        var cardinalController = node.cardinalController;
        var cardinalValue = cardinalController.vmps[ 0 ].dbValue;
        var maxInstances = cardinalController.attrDefn.maxInstances;
        if ( _.isArray( cardinalValue ) ) {
            cardinalValue = cardinalValue[ 0 ];
        }
        if( _.isEmpty( node.instances ) ) {
            isValidData = exports.checkValidValue( data, node.cardinalController, isRequiredAttrsArray, isPoly );
            isValidData = validateCardinality( node, cardinalValue, maxInstances );
            return isValidData;
        }
        //check if the number of instances match the cardinal value
        isValidData = validateCardinality( node, cardinalValue, maxInstances );
        if ( !isValidData.isValidtoSave ) {
            return isValidData;
        }
        for( var i = 0; i < node.instances.length; i++ ) {
            var instance = node.instances[ i ];
            //if the instance is poly
            if( instance.polymorphicTypeProperty ) {
                isValidData = exports.validateProps( instance.polymorphicTypeProperty, isRequiredAttrsArray, data, true );
                if( !isValidData.isValidtoSave ) {
                    if( node.tableView ) {
                        classifyTblSvc.setPolyRequired( data, node, instance );
                    }
                    break;
                }
            }
            isValidData = exports.validateProps( instance, isRequiredAttrsArray, data );
            if( !isValidData.isValidtoSave ) {
                break;
            }
        }
    } else if( node.children ) {
        for( var ii = 0; ii < node.children.length; ii++ ) {
            isValidData = exports.validateProps( node.children[ ii ], isRequiredAttrsArray, data );
            if( !isValidData.isValidtoSave ) {
                break;
            }
        }
    }

    return isValidData;
};

/*
 * Sets the editability of the attribute to the editableFlag value, as well as all children attributes
 * @param {Object} attribute - formatted attribute
 * @param {Boolean} editableFlag - boolean flag for if the attributes should be editable (true) or not (false)
 *
 */
var setAttributeEditable = function( attribute, editableFlag ) {
    if( attribute.type === 'Block' ) {
        _.forEach( attribute.children, function( child ) {
            setAttributeEditable( child, editableFlag );
        } );
    } else {
        attribute.editable = editableFlag;
        if( attribute.vmps[ 0 ] ) {
            attribute.vmps[ 0 ].editable = editableFlag;
            attribute.vmps[ 0 ].isEditable = editableFlag;
        }
    }
};

/*
 * THIS IS A TEMP FIX UNTIL STANDALONE REFACTOR STORY IS COMPLETED

 * Check isRequired properties for class is filled then perform Save operation otherwise display error message
 * @param {Object} data - view model data
 */
/*
 * Check isRequired properties for class is filled then perform Save operation otherwise display error message
 * @param {Object} data - view model data
 */
export let onSaveButtonValidationForStd = function( data, classifyState ) {
    var isRequiredAttrsArray = [];
    var isValidData = {
        invalidAttr: '',
        invalidComplexAttr: '',
        isInRange: true,
        isValidValue: true,
        isValidtoSave: true,
        iskeyValid: true,
        isValidMinMax: true,
        isAllComplexFilled: true,
        isValidTolerance: true,
        isValidNominal: true,
        isCountValid: true
    };

    var invalidPropName = '';

    data.showAllProp = false;
    data.attr_anno = classifyState ? classifyState.attrs : data.classifyState.attrs;

    for( var i = 0; i < data.attr_anno.length; i++ ) {
        isValidData = exports.validateProps( data.attr_anno[ i ], isRequiredAttrsArray, data );
        if( !isValidData.isValidtoSave ) {
            break;
        }
        if( data.eventData && data.eventData.goToView ) {
            setAttributeEditable( data.attr_anno[ i ], false );
        }
    }
    if ( isValidData.isValidtoSave &&
        ( data.eventData && data.eventData.saveAndExitOperation === true && data.eventData.goToView === false ) ) {
        data.eventData.goToView = true;
    }

    var property = {};
    property.sanCommandId = 'classify_save';
    if( classifyState.panelMode !== 1 ) {
        property.sanCommandTitle = classifyState.selectedNode && classifyState.selectedNode.type;
    } else {
        property.sanCommandTitle = 'StorageClass';
    }

    analyticsSvc.logCommands( property );
    var isPasteClicked = classifyState.pasteClicked;

    var isValid = isValidData.isValidtoSave && isValidData.iskeyValid && isValidData.isInRange && isValidData.isValidValue;

    isValid = isValid && ( classifyState.panelMode === 0 && data.attr_anno ) || classifyState.panelMode === 1 && isPasteClicked ||  classifyState.standaloneIco && classifyState.standaloneExists;
    isValidData.isValid = isValid;

    return isValidData;
};


/*
 * Check isRequired properties for class is filled then perform Save operation otherwise display error message
 * @param {Object} data - view model data
 */
/*
 * Check isRequired properties for class is filled then perform Save operation otherwise display error message
 * @param {Object} data - view model data
 */
export let onSaveButtonValidation = function( data, classifyState ) {
    var isRequiredAttrsArray = [];
    var isValidData = {
        invalidAttr: '',
        invalidComplexAttr: '',
        isInRange: true,
        isValidValue: true,
        isValidtoSave: true,
        iskeyValid: true,
        isValidMinMax: true,
        isAllComplexFilled: true,
        isValidTolerance: true,
        isValidNominal: true,
        isCountValid: true
    };

    var invalidPropName = '';

    data.showAllProp = false;
    data.attr_anno = classifyState ? classifyState.value.attrs : data.classifyState.attrs;

    for( var i = 0; i < data.attr_anno.length; i++ ) {
        isValidData = exports.validateProps( data.attr_anno[ i ], isRequiredAttrsArray, data );
        if( !isValidData.isValidtoSave ) {
            break;
        }
        if( data.eventData && data.eventData.goToView ) {
            setAttributeEditable( data.attr_anno[ i ], false );
        }
    }
    if ( isValidData.isValidtoSave &&
        ( data.eventData && data.eventData.saveAndExitOperation === true && data.eventData.goToView === false ) ) {
        data.eventData.goToView = true;
    }

    var property = {};
    property.sanCommandId = 'classify_save';
    if( classifyState.value.panelMode !== 1 ) {
        property.sanCommandTitle = classifyState.value.selectedNode && classifyState.value.selectedNode.type;
    } else {
        property.sanCommandTitle = 'StorageClass';
    }

    analyticsSvc.logCommands( property );
    var isPasteClicked = classifyState.value.pasteClicked;

    var isValid = isValidData.isValidtoSave && isValidData.iskeyValid && isValidData.isInRange && isValidData.isValidValue;
    isValid = isValid && ( classifyState.value.panelMode === 0 && data.attr_anno ) ||
            classifyState.value.panelMode === 1 && isPasteClicked ||  classifyState.value.standaloneIco && classifyState.value.standaloneExists;
    isValidData.isValid = isValid;

    return isValidData;
};

export let setSuggestedSectionState = function( data ) {
    data.suggestedSectionCollapse = !data.suggestedSectionCollapse;
    appCtxSvc.ctx.clsTab.collapseSuggested = data.suggestedSectionCollapse;
};


/**
 * Add to list of standalone objects, or set standalone objects to an empty array. Heavily relies on ctx.
 * @param {Object} ctx the current context being edited.
 * @param {Object} vmo - current view model object to add to context.
 *
 */
let updateStandaloneObjects = function( ctx, vmo ) {
    if ( !ctx.standAloneObjects ) {
        ctx.standAloneObjects = [];
    }
    ctx.standAloneObjects.push( vmo );
};


/**
 * Prepare the objectt to ask for graphics to be saved for.
 * @param {Object} updateTarget the target we are using. If defined, return part family. Else, return template object. type.
 * @param {Object} partFamilyVal - May be undefined. If undefined, do not return.
 * @param {Object} templateObjectVal - May be undefined.
 *
 */
let prepTemplateObjectForGraphicsMsg = function( updateTarget, partFamilyVal, templateObjVal ) {
    if ( updateTarget ) {
        return partFamilyVal.templateObject.uid;
    }
    return templateObjVal.templateObject.uid;
};

/**
 * Updates the most recently used objects list with newly created WSO with graphics on them. Carve out specified MRU from list, add to standalone in CTX.
 * @param {Object} response resposne from SOA call with new model objects that have had graphics created on them.
 * @param {Object} objectName the ID of the updated MRU object.
 * @returns {Array} empty array. populate output of response with this.
 *
 */
export let updateMRUObjectsForGraphicsItems = function( modelObjects, objectName, clsLocationCtx ) {
    _.forEach( modelObjects, function( modelObj ) {
        //add ItemRevisions to MRU list
        if ( modelObj.type === 'ItemRevision' ) {
            var itemId = modelObj.props.item_id.dbValues[ 0 ];
            if ( itemId === objectName ) {
                var vmo = viewModelObjectService.createViewModelObject( modelObj.uid );
                vmo.classId = modelObj.type;
                updateStandaloneObjects( clsLocationCtx, vmo );
                //Have to publish event in JS because ViewModel will carry its data over to the target event instead.
                eventBus.publish( 'classify.loadMRUObjects' );
            }
        }
    } );
};


/**
 * This method is used to get the preference values used in classification tab.
 * @returns {Object} preference values
 */
export let getCLSPreferences = function( ctx ) {
    var clsTab = appCtxSvc.getCtx( 'clsTab' );
    clsTab.preferences = getICSPreferenceValues( ctx.preferences.ICS_attribute_displayable_properties );
    clsTab.eReleases = getReleasePreferenceValues( ctx.preferences.CST_supported_eclass_releases );
    appCtxSvc.updateCtx( 'clsTab', clsTab );
};

/**
 * This method is used to get the preference values for the ICS_attribute_displayable_properties preference.
 * @param {Object} prefValues the preference values
 * @returns {Object} output preference values
 */
export let getICSPreferenceValues = function( prefValues ) {
    var prefs = null;

    if ( prefValues && prefValues.length > 0 ) {
        var pref;
        prefs = [];
        _.forEach( prefValues, function( value ) {
            pref = {
                propDisplayValue: value,
                propDisplayDescription: '',
                propInternalValue: value
            };
            prefs.push( pref );
        } );
    }

    return prefs;
};

/**
 * This method is used to get the preference values for the CST_supported_eclass_releases preference.
 * @param {Object} prefValues the preference values
 * @returns {Object} output preference values
 */
export let getReleasePreferenceValues = function( prefValues ) {
    var prefs = [];
    var isClsActive = appCtxSvc.getCtx( 'preferences.CLS_is_presentation_hierarchy_active' );

    if( isClsActive && isClsActive.length > 0 && isClsActive[0] === 'true' ) {
        if ( prefValues && prefValues.length > 0 ) {
            for( var idx = 0; idx < prefValues.length - 1; idx++ )  {
                var pref = {
                    internalName: prefValues[ idx ],
                    displayName: prefValues[ idx + 1 ]
                };
                idx += 1;
                prefs.push( pref );
            }
        }
    }
    return prefs;
};

let setSectionHeight = function( sectionName, adjust ) {
    var tmpHeight = 'calc(100vh - ' +  adjust  + 'px)';
    var tmpClass = document.getElementById( sectionName );
    if ( tmpClass ) {
        tmpClass.style.height = tmpHeight;
    }
};


/**
 * This method is used to get height of images or properties column
 * @param {Object} data view model
 */
export let selectPropGrp = function( data ) {
    if( data.eventData === null ) {
        data.isFiltered = false;
        data.nodeAttr = null;
    } else {
        data.isFiltered = true;
        data.filteredAttributes = [];
        data.filteredAttributes.push( data.eventData );
        data.nodeAttr = data.filteredAttributes;
        //When selecting a node, expand it automatically
        data.nodeAttr[ 0 ].propExpanded = true;
        if( data.propFilter ) {
            classifyFilterUtils.filterProperties( data );
        }
    }
    return data;
};

/**
 * This method is select attribute
 * @param {Object} data view model
 * @param {Object} attribute attribute
 */
export let selectAttribute = function( data, attribute ) {
    var vmoProp = attribute.vmps[0].attributeInfo;
    appCtxSvc.ctx.attributeProperties = [];

    var attrArr = data.attr_anno;

    deselectAttributes( attrArr );
    attribute.prop[0].selected = true;

    var attrId = attribute.prop[0].attributeId;
    if( attrId.substring( 0, 4 ) === 'cst0' ) {
        attrId = attrId.substring( 4, attrId.length );
    }
    var vmoProp1 = uwPropertyService.createViewModelProperty( 'IRDI', 'IRDI', '', attrId.toString(), attrId.toString() );
    vmoProp1.uiValue = attrId.toString();
    appCtxSvc.ctx.attributeProperties.push( vmoProp1 );
    for ( var i = 0; i < classifySvc.UNCT_ATTR_PROP.length; i++ ) {
        var key = classifySvc.UNCT_ATTR_PROP[i];
        var value = classifySvc.getPropertyValue(
            vmoProp, key );

        key = classifySvc.UNCT_ATTR_PROP_DISP[i];
        var vmoProp1 = uwPropertyService.createViewModelProperty( key, key, '', value.toString(), value.toString() );
        vmoProp1.uiValue = value.toString();
        appCtxSvc.ctx.attributeProperties.push( vmoProp1 );
    }
};

/**
 * This method deselects attributes
 * @param {Object} attrArr attribute array
 */
export let deselectAttributes = function( attrArr ) {
    _.forEach( attrArr, function( group ) {
        if( group.type === 'Block' ) {
            if( group.children && group.children.length > 0 ) {
                deselectAttributes( group.children );
                //Cardinal Block
            }
            if ( group.polymorphicTypeProperty ) {
                group.polymorphicTypeProperty.vmps[ 0 ].selected = false;
            }
        } else{
            group.vmps[0].selected = false;
        }
    } );
};


export default exports = {
    addItems,
    attributeBlockExpandCollapse,
    buildStandaloneIDField,
    checkValidValue,
    collapseAll,
    collapseAllCmd,
    copyTableColumn,
    clearAllProperties,
    clearAllProps,
    convertAttr,
    convertValues2,
    setCheckboxFalse,
    createGraphicsBuilderTableProps,
    createStandaloneVMO,
    deselectAttributes,
    deselectICOBeforeEditing,
    divideTemplateTypes,
    expandAll,
    expandAllCmd,
    formatAttributes,
    formatImageAttachments,
    formatSearchResults,
    formatSearchResultsForVNC,
    generateCells,
    getClassifyNonClassify,
    getClassProperties,
    getCLSPreferences,
    getEditableAttributes,
    getICSPreferenceValues,
    getUnitsAndConvert,
    getReleasePreferenceValues,
    getSuggestedClasses,
    highlightKeywords,
    initSuggestionsPanel,
    isAttributeEditable,
    isSelectedObjectStandAlone,
    loadSuggestions,
    mandatoryFields,
    noAction,
    navigateToSuggestedClass,
    onCircularPrevChevronClick,
    onCircularNextChevronClick,
    onNextChevronClick,
    onPrevChevronClick,
    onSaveButtonValidation,
    parseSearchString,
    pasteCommandHide,
    pasteClicked,
    prepTemplateObjectForGraphicsMsg,
    processEdit,
    propertyFilter,
    resetAttributeFilter,
    resetEventMapForPropValidation,
    resetHierarchy,
    resetImagesSection,
    resetPropertiesImagesSection,
    resetPropertiesSection,
    resetPropertyGroupSelection,
    resetView,
    selectAttribute,
    selectPropGrp,
    setNotifyMessage,
    setSuggestedSectionState,
    setUnitSystem,
    showImagesMaximized,
    showMandatoryProperties,
    toggleTableView,
    updateCardinalBlocks,
    updateMRUObjectsForGraphicsItems,
    updateSelectedClassFromTree,
    updateRecentsAfterObjectSync,
    validateComplexFields,
    validateProps,
    onSaveButtonValidationForStd
};
