/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This is a utility for admin services
 *
 * @module js/classifyAdminService
 */
import appCtxService from 'js/appCtxService';
import awIconSvc from 'js/awIconService';
import browserUtils from 'js/browserUtils';
import parsingUtils from 'js/parsingUtils';
import classifyAdminConstants from 'js/classifyAdminConstants';
import classifyAdminUtil from 'js/classifyAdminUtil';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import iconSvc from 'js/iconService';
import notyService from 'js/NotyModule';
import logger from 'js/logger';
import soaService from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import localeSvc from 'js/localeService';
import _ from 'lodash';

var exports = {};
var _isNextPage = false;
var _timeout = null;

//Upon clicking the Node bar chart this helps to redirect to the correct
//tab
var NODES = 'clsNodes';
var CLASSES = 'clsClasses';
var PROPERTIES = 'clsProperty';
var KEYLOV = 'clsKeylov';

var isSubLocation = false;

var locale = localeSvc.getLocale();
if( locale.length === 2 ) {
    // SSO needs the 5 character locale, so "special case" the supported locales
    switch ( locale ) {
        case 'en':
            locale = 'en_US';
            break;
        case 'es':
            locale = 'es_ES';
            break;
        case 'de':
            locale = 'de_DE';
            break;
        case 'fr':
            locale = 'fr_FR';
            break;
        case 'it':
            locale = 'it_IT';
            break;
        default:
            // do nothing
            break;
    }
}

/**
 * This method is used to get the preference values for the CLS_CST_supported_eclass_releases preference.
 * @param {Object} response the response of the getPreferences soa
 * @returns {Object} preference values
 */
export let getReleasePreferenceValues = function( response ) {
    var prefs = [];

    var preferences = response.preferences;
    if( preferences.length > 0 && preferences[ 0 ].values ) {
        for( var idx = 0; idx < preferences[ 0 ].values.length - 1; idx++ ) {
            var pref = {
                internalName: preferences[ 0 ].values[ idx ],
                displayName: preferences[ 0 ].values[ idx + 1 ]
            };
            idx += 1;
            prefs.push( pref );
        }
    }

    return prefs;
};

/**
 * Following method retrieves expression based on collection of IRDI values provided
 *
 * @param {Array} ArrIRDI Collection of IRDI's
 * @param {*} type Supplied type
 * @returns {*} criteria
 */
export let getSearchCriteriaForArrayIRDI = function( ArrIRDI, type ) {
    var searchCriteria;
    searchCriteria = getExpressionForArrayIRDI( ArrIRDI, type );
    return searchCriteria;
};

/**
 * Following method build expression for supplied IRDI's
 * @param {Array} ArrIRDI Collection of IRDI's
 * @param {*} type Supplied type
 * @returns {*} expression
 */
export let getExpressionForArrayIRDI = function( ArrIRDI, type ) {
    return {
        ObjectType: type,
        SearchExpression: {
            $in: {
                ID: classifyAdminConstants.IRDI,
                Value: ArrIRDI
            }
        },
        Options: {
            loadObjects: true
        },
        Select: [
            classifyAdminConstants.IRDI,
            classifyAdminConstants.NAME
        ]
    };
};

/**
 * Following method checks whether the given string is of class type
 * @param {String} classTypeVal Refers to Class Type value
 * @return {Boolean} class type
 */
export let isClassType = function( classTypeVal ) {
    var isClassType = false;
    if( classTypeVal === classifyAdminConstants.APP_CLASS || classTypeVal === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT ||
        classTypeVal === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_BLOCK ) {
        isClassType = true;
    }
    return isClassType;
};

let addImage = function( object, type, classType ) {
    var imageIconUrl;
    var classifyIconName = 'indicatorMissingImage16.svg';
    if( type === classifyAdminConstants.NODES || type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        classifyIconName = 'typeClassificationElement48.svg';
    } else if( type === classifyAdminConstants.CLASSES || type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
        if( classType === classifyAdminConstants.APP_CLASS ) {
            classifyIconName = 'typeApplicationClass48.svg';
        } else if( classType === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT ) {
            classifyIconName = 'typeAspect48.svg';
        } else if( classType === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_BLOCK ) {
            classifyIconName = 'typeBlocks48.svg';
        }
    } else if( type === classifyAdminConstants.PROPERTIES || type === classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) {
        classifyIconName = 'typeProperty48.svg';
    } else if( type === classifyAdminConstants.KEYLOV || type === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
        classifyIconName = 'typeOptionValue48.svg';
    }
    if( object.IconFileTicket ) {
        imageIconUrl = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
            fmsUtils.getFilenameFromTicket( object.IconFileTicket ) + '?ticket=' + object.IconFileTicket;
    } else {
        imageIconUrl = iconSvc.getTypeIconFileUrl( classifyIconName );
    }
    return imageIconUrl;
};

/**
 * Returns release displayname
 *
 * @param {Object} releases list of releases
 * @param {String} name internal name,
 * @returns {String} release display name
 */
let getReleaseDisplayName = function( releases, name ) {
    var displayName = name;
    if( releases && releases.eReleases ) {
        var idx = _.findIndex( releases.eReleases, function( release ) {
            return name === release.internalName;
        } );
        if( idx !== -1 ) {
            displayName = releases.eReleases[ idx ].displayName;
        }
    }
    return displayName;
};

/**
 * Returns selected releases
 *
 * @param {Object} data data
 * @returns {Array} selected release
 */
let getSelectedReleases = function( data ) {
    let supportedRelease = appCtxService.getCtx( 'preferences.CST_supported_eclass_releases' );

    let orignalLength;
    if( supportedRelease && supportedRelease.length ) {
        orignalLength = supportedRelease.length / 2;
    }
    let selected = [];
    let searchState = data && data.subPanelContext && data.subPanelContext.searchState ? data.subPanelContext.searchState : {};
    if( searchState && searchState.releases && searchState.releases.releasesStruct && searchState.releases.releasesStruct.length > 0 ) {
        _.forEach( data.subPanelContext.searchState.releases.releasesStruct, function( release ) {
            selected.push( release );
        } );

        if( selected.length === orignalLength ) {
            selected = [];
        }
    }
    return selected;
};
/**
 * Create object
 *
 * @param {Object} child child
 * @param {String} type JSON request object type
 * @param {Object} adminCtx admin context
 * @returns {Object} cells
 */
let getObject = function( child, type, adminCtx ) {
    var name = child.Name;
    if( child.SourceStandard ) {
        var displayName = getReleaseDisplayName( adminCtx.releases, child.SourceStandard );
        name += ' ( ' + displayName + ' )';
    }
    var cell = uwPropertySvc.createViewModelProperty( name, name, child.ObjectType, '', name );
    cell.cellHeader1 = name;
    cell.cellInternalHeader1 = name;
    cell.cellExtendedTooltipProps = name;
    cell.name = type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ? child.NodeId : child.IRDI;
    cell.id = cell.name;
    cell.uid = cell.id;
    cell.hasChildren = child.HasChildren;
    cell.type = type;

    //add missing icon
    var imageIconUrl;
    if( !isSubLocation ) {
        var tmpIcon = {
            typeHierarchy: '0'
        };
        imageIconUrl = awIconSvc.getTypeIconFileUrl( tmpIcon );
    }

    var classType = type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ? child.ClassType : null;
    imageIconUrl = addImage( child, type, classType );
    cell.thumbnailURL = imageIconUrl;
    cell.hasThumbnail = true;
    cell.parents = child.Parents;

    return cell;
};

/**
 * Created objects from the response for give type
 *
 * @param {Object} childNodes Objects
 * @param {String} type Supplied Object type
 * @returns {Object} cells
 */
export let getObjects = function( childNodes, type ) {
    var cells = [];
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );

    _.forEach( childNodes, function( child ) {
        var cell = getObject( child, type, adminCtx );
        cells.push( cell );
    } );

    return cells;
};

/**
 * Adjust search criteria  as needed
 * @param {Object} type type of object
 * @param {Object} criteria search criteria
 */
export let updateSearchCriteria = function( type, criteria ) {
    //Nodes do not have IRDIs. Replace with ID
    if( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        criteria.Select[ 0 ] = classifyAdminConstants.NODE_ID;
        criteria.Select.push( classifyAdminConstants.NODE_PUID );
        criteria.Select.push( classifyAdminConstants.NODE_ICONFILE_TICKET );
    } else if( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
        criteria.Select.push( 'ClassType' );
    }
};

/**
 * toggle importMode as import operation is performed
 * @param {Object} data type of object
 * @returns {Boolean} toggle importMode
 */
export let toggleImportMode = function( data ) {
    return !data.importMode;
};

/**
 * Gets search criteria based on type after Import
 * @param {Object} dataProvider data provider
 * @param {String} type Object type
 * @returns {Object} search criteria
 */
export let getSearchCriteriaAfterImport = function( dataProvider, type ) {
    return getSearchCriteriaForType( dataProvider, type, 0 );
};

/**
 * Gets search criteria based on type
 * @param {Object} dataProvider data provider
 * @param {String} type Object type
 * @param {BigInteger} index offset if importmode is true else undefined
 * @returns {Object} search criteria
 */
export let getSearchCriteriaForType = function( dataProvider, type, index ) {
    //var startIndex = index !== undefined ? index : dataProvider.viewModelCollection.loadedVMObjects !== undefined ? dataProvider.viewModelCollection.loadedVMObjects.length : 0;
    var startIndex;
    if( index !== undefined ) {
        startIndex = index;
    } else if( dataProvider.viewModelCollection.loadedVMObjects !== undefined ) {
        startIndex = dataProvider.viewModelCollection.loadedVMObjects.length;
    } else {
        startIndex = 0;
    }
    var criteria = {
        ObjectType: type,
        Options: {
            limit: 50,
            offset: startIndex
        },
        OrderBy: [ {
            ID: classifyAdminConstants.NAME,
            Sort: classifyAdminConstants.SORT_ASC
        } ],
        Select: [
            classifyAdminConstants.IRDI,
            classifyAdminConstants.NAME,
            classifyAdminConstants.HAS_CHILDREN
        ]
    };

    updateSearchCriteria( type, criteria );
    return criteria;
};

/**
   * Gets search criteria based on type
   * @param {Object} data view model
   * @param {String} dataProvider dataProvider
   * @param {String} type Object type
   * @param {Object} parentNode parentNode. Optional
   * @param {Boolean} isSearch isSearch. Optional

   * @returns {Object} search criteria
   */
export let getSearchCriteriaForTree = function( data, dataProvider, type, parentNode, isSearch ) {
    var criteria = getSearchCriteriaForType( dataProvider, type );
    var addSource = true;

    var selected = getSelectedReleases( data );
    //selected will not be set if filters panel is not invoked
    // Do not add source standard for single selection
    if( selected.length === 1 ) {
        addSource = false;
    }

    if( addSource ) {
        criteria.Select.push( classifyAdminConstants.SOURCE_STANDARD );
    }

    //adjust start index
    if( data.treeLoadInput ) {
        criteria.Options.offset = data.treeLoadInput.startChildNdx;
        if ( _isNextPage ) {
            if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE && data.data.nodes ) {
                criteria.Options.offset = data.data.nodes.length;
                data.treeLoadInput.startChildNdx = data.data.nodes.length;
            } else if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS && data.data.classes ) {
                criteria.Options.offset = data.data.classes.length;
                data.treeLoadInput.startChildNdx = data.data.classes.length;
            }
        }
    }
    if( isSearch && data.treeLoadInput.startChildNdx > 0 ) {
        criteria.Options.offset = data.tmpObjectsLoaded;
    }
    return criteria;
};

/**
 * Gets search criteria based on type
 * @param {Object} data view model
 * @param {Object} dataProvider dataProvider
 * @param {String} type Object type
 * @param {Object} parentNode parentNode
 * @param {Object} isSearch true if search, false otherwise
 * @returns {Object} search criteria
 */
export let getSearchCriteriaForHierarchy = function( data, dataProvider, type, parentNode, isSearch ) {
    var criteria = getSearchCriteriaForTree( data, dataProvider, type, parentNode, isSearch );
    var expression;
    if( parentNode.uid === classifyAdminConstants.TOP || _isNextPage ) {
        expression = {
            $null: {
                ID: classifyAdminConstants.PARENTS
            }
        };
    } else {
        criteria.Options.loadObjects = true;
        expression = {
            $eq: {
                ID: classifyAdminConstants.IMMEDIATE_PARENT,
                Value: parentNode.uid
            }
        };
    }
    // For nodes and classes, add Parents to criteria to set up hierarchy
    if( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS || type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        criteria.Select.push( classifyAdminConstants.PARENTS );
    }
    criteria.SearchExpression = expression;
    return criteria;
};

/**
 * Builds Search Criteria for SOA
 * @param {*} IRDI IRDI of Object
 * @param {*} type Type of Object
 * @returns {Object} search criteria
 */
export let getSearchCriteriaForIRDI = function( IRDI, type ) {
    var criteria = {
        ObjectType: type,
        SearchExpression: {
            $eq: {
                ID: classifyAdminConstants.IRDI,
                Value: IRDI
            }
        },
        Options: {
            loadObjects: true
        },
        OrderBy: [ {
            ID: classifyAdminConstants.NAME,
            Sort: classifyAdminConstants.SORT_ASC
        } ]
    };
    if( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        criteria.SearchExpression.$eq.ID = classifyAdminConstants.NODE_ID;
        criteria.Select = [
            classifyAdminConstants.NODE_PUID,
            classifyAdminConstants.NODE_IMAGEFILE_TICKETS
        ];
    }
    return criteria;
};

/**
 * Method populates builds the JSON request for SOA
 * @param {String} IRDI IRDI of object
 * @param {String} type type of object
 * @returns {String} JSON object
 */
export let getJsonRequestForIRDI = function( IRDI, type ) {
    var jsonRequest = {
        SchemaVersion: classifyAdminConstants.JSON_REQUEST_SCHEMA_VERSION,
        Locale: locale,
        IncludeDisplayNames: true,
        SearchCriteria: getSearchCriteriaArrayIRDI( IRDI, type )
    };
    return JSON.stringify( jsonRequest );
};

/**
 * Method creates collection of search criteria's
 * @param {Object} IRDI IRDI of Object
 * @param {String} type type of object
 * @returns {Array} search criteria
 */
export let getSearchCriteriaArrayIRDI = function( IRDI, type ) {
    var searchCriteria = [];
    searchCriteria[ 0 ] = getSearchCriteriaForIRDI( IRDI, type );
    return searchCriteria;
};

/**
 * Gets search criteria based on defined filters and search box input.
 *
 * @param {Object} data view model
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {Object} criteria search criteria
 */
let updateSearchCriteriaForSearch = function( data, parentNode, isSearch, criteria ) {
    if( isSubLocation && isSearch ) {
        if( !parentNode || parentNode.uid === classifyAdminConstants.TOP || _isNextPage ) {
            //add searchbox value
            if( data.searchBox.dbValue !== null && data.searchBox.dbValue !== '' ) {
                //Both class hierarchy and name search criteria use the search expression value.
                criteria[ 0 ].SearchExpression = getSearchExpressionForName( data.searchBox.dbValue );
            }
            //add release filter to the search
            var selected = getSelectedReleases( data );
            if( selected.length > 0 ) {
                var selectedStr = [];
                _.forEach( selected, function( release ) {
                    // push all releases into array
                    selectedStr.push( release.propInternalValue );
                } );
                criteria[ 0 ].SearchExpression = modifySearchCriteriaForFilter( criteria[ 0 ],
                    classifyAdminConstants.SOURCE_STANDARD,
                    selectedStr, true );
            }
        } else {
            if( data.searchBox.dbValue !== null && data.searchBox.dbValue !== '' ) {
                //Both class hierarchy and name search criteria use the search expression value.
                var searchExpr = getSearchExpressionForName( data.searchBox.dbValue );
                if( criteria[ 0 ].SearchExpression ) {
                    var uidExpr = criteria[ 0 ].SearchExpression;
                    var andExpression = {
                        $and: [ uidExpr, searchExpr ]
                    };
                    criteria[ 0 ].SearchExpression = andExpression;
                }
            }
        }
        //add filters
        if( data && data.subPanelContext && data.subPanelContext.searchState && data.subPanelContext.searchState.filterMap && data.subPanelContext.searchState.filterMap.length ) {
            for( var filter of data.subPanelContext.searchState.filterMap ) {
                if( filter[ 0 ] && filter[ 1 ] ) {
                    criteria[ 0 ].SearchExpression = modifySearchCriteriaForFilter( criteria[ 0 ], filter[ 0 ], filter[ 1 ] );
                }
            }
        }
    }
};

/**
 * Gets search criteria based on type
 *
 * @param {Object} data view model
 * @param {String} type type of object
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {Object} subPanelContext subpanel context
 * @returns {Object} search criteria
 */
export let getSearchCriteria = function( data, type, parentNode, isSearch, subPanelContext ) {
    var searchCriteria = [];
    if( type === 'Attributes' ) {
        if( data.aspects && data.aspects.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( data.aspects, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) );
        }
        if( data.property && data.property.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( data.property, classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) );
        }
    }
    if( type === 'AttributesPanel' ) {
        if( subPanelContext.searchState.Panelaspects && subPanelContext.searchState.Panelaspects.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( subPanelContext.searchState.Panelaspects, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) );
        }
        if( subPanelContext.searchState.Panelproperty && subPanelContext.searchState.Panelproperty.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( subPanelContext.searchState.Panelproperty, classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) );
        }
    } else if( type === classifyAdminConstants.PROPERTIES ) {
        if( isSubLocation ) {
            searchCriteria[ 0 ] = getSearchCriteriaForTree( data, data.dataProviders.properties, classifyAdminConstants.JSON_REQUEST_TYPE_PROP, parentNode, isSearch );
        } else {
            searchCriteria[ 0 ] = getSearchCriteriaForType( data.dataProviders.properties, classifyAdminConstants.JSON_REQUEST_TYPE_PROP );
        }
    } else if( type === classifyAdminConstants.KEYLOV ) {
        if( isSubLocation ) {
            searchCriteria[ 0 ] = getSearchCriteriaForTree( data, data.dataProviders.keylov, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV, parentNode, isSearch );
        } else {
            searchCriteria[ 0 ] = getSearchCriteriaForType( data.dataProviders.keylov, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV );
        }
    } else if( type === classifyAdminConstants.CLASSES ) {
        if( isSubLocation ) {
            searchCriteria[ 0 ] = getSearchCriteriaForHierarchy( data, data.dataProviders.classes, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS, parentNode, isSearch );
        } else {
            searchCriteria[ 0 ] = getSearchCriteriaForType( data.dataProviders.classes, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS );
        }
    } else if( type === classifyAdminConstants.NODES ) {
        if( isSubLocation ) {
            searchCriteria[ 0 ] = getSearchCriteriaForHierarchy( data, data.dataProviders.nodes, classifyAdminConstants.JSON_REQUEST_TYPE_NODE, parentNode, isSearch );
        } else {
            searchCriteria[ 0 ] = getSearchCriteriaForType( data.dataProviders.nodes, classifyAdminConstants.JSON_REQUEST_TYPE_NODE );
        }
    } else if( type === 'Summary' ) {
        if( !data.importMode || data.importMode === undefined ) {
            searchCriteria[ 0 ] = getSearchCriteriaForType( data.dataProviders.properties, classifyAdminConstants.JSON_REQUEST_TYPE_PROP );
            searchCriteria[ 1 ] = getSearchCriteriaForType( data.dataProviders.keylov, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV );
            searchCriteria[ 2 ] = getSearchCriteriaForType( data.dataProviders.classes, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS );
            searchCriteria[ 3 ] = getSearchCriteriaForType( data.dataProviders.nodes, classifyAdminConstants.JSON_REQUEST_TYPE_NODE );
        } else {
            searchCriteria[ 0 ] = getSearchCriteriaAfterImport( data.dataProviders.properties, classifyAdminConstants.JSON_REQUEST_TYPE_PROP );
            searchCriteria[ 1 ] = getSearchCriteriaAfterImport( data.dataProviders.keylov, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV );
            searchCriteria[ 2 ] = getSearchCriteriaAfterImport( data.dataProviders.classes, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS );
            searchCriteria[ 3 ] = getSearchCriteriaAfterImport( data.dataProviders.nodes, classifyAdminConstants.JSON_REQUEST_TYPE_NODE );
        }
    }

    updateSearchCriteriaForSearch( data, parentNode, isSearch, searchCriteria );
    return searchCriteria;
};

/**
 * Builds Search Criteria for SOA
 * @param {*} name name of Object
 * @returns {Object} search expression
 */
export let getSearchExpressionForName = function( name ) {
    //Add the query data for search by name case.
    return {
        $like: {
            ID: classifyAdminConstants.NAME,
            Value: '*' + name + '*'
        }
    };
};

/**
 * Following method acts as a data fetecher for data provider
 * @param {Object} data Declarative view model
 * @param {Object} type Supplied type
 * @param {Object} subPanelContext subpanel context
 * @returns {Objects} response 1 Returns entries
 */
export let loadDataForAttributes = function( data, type, subPanelContext ) {
    var parentNode = {};
    var isSearch = false;
    var request = {
        jsonRequest: getJsonRequestForSearch( data, type, parentNode, isSearch, subPanelContext  )
    };

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var propDefs = classifyAdminUtil.parseJson( response.out, type, false );
        var tmpProps = getObjects( propDefs.objects, type );
        data.tmpObjects = tmpProps;
        data.propsFound = propDefs.totalFound;

        //fill column property
        for( var i = 0; i < data.tmpObjects.length; i++ ) {
            var temp2 = {};
            temp2 = classifyAdminUtil.createCell( classifyAdminConstants.COLUMN_NAME, data.tmpObjects[ i ].propertyName );
            var tempProps = {};
            tempProps[ classifyAdminConstants.COLUMN_NAME ] = temp2;
            data.tmpObjects[ i ].props = tempProps;
        }

        return {
            objects: data.tmpObjects,
            totalFound: data.propsFound
        };
    } );
};

/**
 * Builds Search Criteria for SOA
 * @param {Object} establishedCriteria the criteria that is already known.
 * @param {Object} newFilter the new filter being added to the criteria..
 * @param {Object} newFilterValue new value to filter by.
 * @param {Object} isMultiple true if multiple allow values
 * @returns {Object} search criteria specifying to find objects of given criteria with determined filters.
 */
export let modifySearchCriteriaForFilter = function( establishedCriteria, newFilter, newFilterValue, isMultiple ) {
    var expression = {};
    var expr = {
        ID: newFilter,
        Value: isMultiple ? newFilterValue : '*' + newFilterValue + '*'
    };
    if( isMultiple ) {
        //releases can be multiple
        expression.$in = expr;
    } else {
        expression.$like = expr;
    }
    var searchExpr = establishedCriteria.SearchExpression;

    if( !searchExpr ) {
        searchExpr = expression;
        //If searchExpression, may contain single $like or $in value.
    } else if( !searchExpr.$and ) {
        var $like = searchExpr.$like;
        var $in = searchExpr.$in;
        if( $like || $in ) {
            var andExpression = {
                $and: []
            };
            if( $like ) {
                andExpression.$and.push( { $like } );
            }
            if( $in ) {
                andExpression.$and.push( { $in } );
            }
            andExpression.$and.push( expression );
            expression = andExpression;
        }
        searchExpr = expression;
    } else {
        searchExpr.$and.push( expression );
    }

    return searchExpr;
};

/**
 * Builds Search Criteria for SOA
 * @param {String} name name of Object
 * @param {Object} criteria search criteria
 * @returns {Object} search criteria specifying to find objects of given criteria with a part of the name containing given name.
 */
export let getSearchCriteriaForName = function( name, criteria ) {
    //Add the query data for search by name case.
    var expression = {
        $like: {
            ID: classifyAdminConstants.NAME,
            Value: '*' + name + '*'
        }
    };
    if( !criteria.SearchExpression ) {
        criteria.SearchExpression = expression;
    } else {
        criteria.SearchExpression.$like = expression.$like;
    }
    return criteria;
};

/**
 * Clears the old object names/error status to populate new object names/error status
 * @param {*} data view model
 * @returns {Object} data
 */
export let clearData = function( data ) {
    data.captionName = '';
    data.systemError = false;
    if( data.objectNames !== undefined ) {
        data.objectNames = '';
        data.errorsExist = false;
    }
    return {
        captionName: data.captionName,
        systemError: data.systemError,
        objectNames: data.objectNames,
        errorExist: data.errorExist
    };
};

/**
 * Method creates JSON request for Search operaion as per supplied type of selected object
 *
 * @param {Object} data view model
 * @param {String} type type of object
 * @param {Object} parentNode parent node
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {Object} subPanelContext subpanel context
 * @returns {Object} JSON string
 */
export let getJsonRequestForSearch = function( data, type, parentNode, isSearch, subPanelContext ) {
    var jsonRequest = {
        SchemaVersion: classifyAdminConstants.JSON_REQUEST_SCHEMA_VERSION,
        Locale: locale,
        IncludeDisplayNames: true,
        SearchCriteria: getSearchCriteria( data, type, parentNode, isSearch, subPanelContext )
    };
    appCtxService.ctx.offset += 10;

    return JSON.stringify( jsonRequest );
};

/**
 * Following method calls SOA to get keyLOVs in tree format
 * @param {String} IRDI IRDI
 * @param {String} type Data Type
 * @param {Object} system Metric or Non - metric system key
 * @param {Object} subPanelContext sub panel context object
 */
export let getKeyLOV = function( IRDI, type, system, subPanelContext ) {
    var request = {
        jsonRequest: getJsonRequestForIRDI( IRDI, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV )
    };

    soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var tree = [];
        var tmpKeylovs;
        var keyLOVObj;

        tmpKeylovs = classifyAdminUtil.parseJsonForObjectDefinitions( response.out );
        keyLOVObj = tmpKeylovs[ IRDI ];

        var lovItems = keyLOVObj[ classifyAdminConstants.KEYLOV_LOVITEMS ];
        var key = classifyAdminConstants.JSON_RESPONSE_LOV + lovItems[ classifyAdminConstants.DATA_TYPE ] + classifyAdminConstants.JSON_RESPONSE_ITEMS;
        var LOVTypeItems = lovItems[ key ];

        var tmpState = subPanelContext.searchState.value;

        //Check for keys
        if( key === classifyAdminConstants.JSON_RESPONSE_KEYLOV_BOOLEAN ) {
            //Boolean type. It will always contains two values only
            buildLOVForBoolean( LOVTypeItems, tree );
        } else {
            for( var i = 0; i < LOVTypeItems.length; i++ ) {
                buildLOV( LOVTypeItems[ i ], type, tree );
            }
        }

        if( system === classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) {
            tmpState.propertiesSWA.keyLOVTreeDataNonMetric = tree;
        } else {
            tmpState.propertiesSWA.keyLOVTreeDataMetric = tree;
        }
        subPanelContext.searchState.update( tmpState );
    } );
};

/**
 * Build LOV and adds to the application context
 * @param {Object} LOVObj LOV object to look up for
 * @param {*} tree treeData representation
 */
export let buildLOVForBoolean = function( LOVObj, tree ) {
    _.forEach( classifyAdminConstants.ARR_KEYLOV_RESPONSE_BOOL, function( key ) {
        var Obj = classifyAdminUtil.getObjectAsPerKey( LOVObj, key );
        var node = {};

        node.label = key + classifyAdminConstants.COLON + classifyAdminUtil.getObjectAsPerKey( Obj, classifyAdminConstants.DISPLAY_VALUE );
        node.children = [];
        tree.push( node );
    } );
};

/**
 * Builds LOV and add to the application context
 * @param {*} LOVObj LOVObject to look up for
 * @param {*} type DataType value
 * @param {*} tree treeData representation
 */
export let buildLOV = function( LOVObj, type, tree ) {
    //Individual node to be added
    var node = {};

    if( type === classifyAdminConstants.DATA_TYPE_REFERENCE ) {
        //special case for reference
        type = classifyAdminConstants.DATA_TYPE_STRING;
    }
    var entry = type + classifyAdminConstants.VALUE_KEY;

    var key = classifyAdminUtil.getObjectAsPerKey( LOVObj, entry );

    node.label = key;

    if( LOVObj.hasOwnProperty( classifyAdminConstants.DISPLAY_VALUE ) ) {
        node.label = key + classifyAdminConstants.COLON + classifyAdminUtil.getValue( LOVObj[ classifyAdminConstants.DISPLAY_VALUE ] );
    }

    node.children = [];

    //Check submenu exists
    var Is_submenu = classifyAdminUtil.getObjectAsPerKey( LOVObj, classifyAdminConstants.KEYLOV_IS_SUBMENU );
    if( Is_submenu === true ) {
        //add submenu items
        var subItems = classifyAdminUtil.getObjectAsPerKey( LOVObj, classifyAdminConstants.KEYLOV_SUB_MENUITEMS );
        for( var i = 0; i < subItems.length; i++ ) {
            buildLOV( subItems[ i ], type, node.children );
        }

        //check for submenu title
        //If IsSubMenu is set to true and the SubMenuTitle is missing, the SubMenuTitle is set to the DisplayValue.
        //If both are missing, the SubMenuTitle is set to the mandatory property StringValue.
        var subMenuTitle = classifyAdminUtil.getObjectAsPerKey( LOVObj, classifyAdminConstants.KEYLOV_SUB_MENU_TITLE );
        if( subMenuTitle && subMenuTitle !== '' ) {
            node.label = subMenuTitle;
        }
    }
    tree.push( node );
};

/**
 * Update selected releases
 *
 * @param {ViewModelProperty} prop - ViewModelProperty,
 * @param {Object} adminCtx admin context
 */
export let updateSelectedReleases = function( prop, adminCtx ) {
    let isValid = true;
    if( prop.propApi.validationApi ) {
        isValid = prop.propApi.validationApi( prop.dbValue );
    }
    if( isValid ) {
        adminCtx.releases.selected = adminCtx.releases.expandedList;
        // var prefs = prop.dbValue.split( ', ' );
        _.forEach( adminCtx.releases.selected, function( release ) {
            release.selected = 'false';
        } );
        _.forEach( prop.dbValue, function( pref ) {
            var jdx = _.findIndex( adminCtx.releases.selected, function( release ) {
                return release.internalName === pref;
            } );
            adminCtx.releases.selected[ jdx ].selected = 'true';
        } );
    }
};


/**
 * Add releases from preferences to LOV
 *
 * @param {ViewModelProperty} prop - the view model property
 * @param {Boolean} reset true if reset, false otherwise
 */
export let getReleasesExpanded = function( prop, reset ) {
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    var releasesExpandedList = [];
    if( !adminCtx.releases.expandedList || reset ) {
        _.forEach( adminCtx.releases.eReleases, function( release ) {
            var tmpProp = {
                internalName: release.internalName,
                displayName: release.displayName,
                selected: 'true'
            };
            releasesExpandedList.push( tmpProp );
        } );
        adminCtx.releases.expandedList = releasesExpandedList;
        appCtxService.updateCtx( 'clsAdmin', adminCtx );
    } else {
        releasesExpandedList = adminCtx.releases.expandedList;
    }

    var releasesSelected = _.filter( releasesExpandedList, function( o ) {
        return o.selected === 'true';
    } );
    adminCtx.releases.selected = releasesSelected;

    var db = [];
    var display = [];
    var displayStr = '';
    if( releasesExpandedList && releasesExpandedList.length > 0 ) {
        _.forEach( releasesExpandedList, function( release ) {
            if( release.selected === 'true' ) {
                db.push( release.internalName );
                display.push( release.displayName );
                displayStr += displayStr === '' ? '' : ', ';
                displayStr += release.displayName;
            }
        } );
    }

    prop.dbValue = db;
    prop.uiValues = display;
    prop.displayValues = display;
    prop.uiValue = displayStr;
};

/**
 * Replaces the objects in a set with new ones and replaces the record for the number of objects it contains with a new number.
 * @param {Array} origSet Object set to replace with new set of objects.
 * @param {*} origFound Number of found objects to rewrite with new information.
 * @param {*} dataProvider Data provider to update for display purposes
 * @param {Array} newSet Set of new objects.
 */
let replaceObjects = function( origSet, origFound, dataProvider, newSet ) {
    // Like in case of search, need to overwrite the contents of the given tab.
    origSet = newSet;
    origFound = newSet.length;
    dataProvider.viewModelCollection.setViewModelObjects( origSet );
    dataProvider.viewModelCollection.totalFound = origFound;
};

/**
 * Updates the objects in a set with new objects.
 * @param {Object} origObjects Object set to append with new objects; can be empty.
 * @param {Object} newObjects New objects to insert into the old set.
 * @param {Boolean} isNextPage true if next page, false otherwise
 * @return {Object} updated orig set
 */
let updateObjects = function( origObjects, newObjects, isNextPage ) {
    if( !origObjects || !isNextPage ) {
        origObjects = newObjects;
    } else {
        _.forEach( newObjects, function( obj ) {
            var idx = _.findIndex( origObjects, function( origObj ) {
                return origObj.id === obj.id;
            } );
            if( idx === -1 ) {
                origObjects.push( obj );
            }
        } );
        origObjects = _.sortBy( origObjects, 'propertyName' );
    }
    return origObjects;
};

/**
 * Method cleans the secondary work area data
 * @param {Object} subPanelContext sub panel context object
 */
export let resetSWAData = function( subPanelContext ) {
    if( subPanelContext !== undefined && subPanelContext.searchState.propertiesSWA !== undefined ) {
        var tmpState = subPanelContext.searchState.value;
        tmpState.propertiesSWA = {};
        subPanelContext.searchState.update( tmpState );
    }
};

/**
 * Method creates VMO property for SWA
 * @param {Object} obj Object contains key-value pairs of meta-data properties
 * @param {String} key Ket to look up for within the object
 * @param {Array} arr Array refernce for VMO collection
 */
export let createSWAProperty = function( obj, key, arr ) {
    var valueObj = obj[ key ];
    var displayName;
    if( obj.displayNames !== '' && obj.displayNames !== undefined && obj.displayNames[ key ] !== '' && obj.displayNames[ key ] !== undefined ) {
        displayName = obj.displayNames[ key ];
    } else {
        displayName = key;
    }
    var cell;
    var value;

    if( key === classifyAdminConstants.PARENTS && Array.isArray( valueObj ) ) {
        value = valueObj[ 0 ];
        cell = uwPropertySvc.createViewModelProperty( key, displayName, '', value.toString(), value.toString() );
        cell.uiValue = value.toString();
    } else if( Array.isArray( valueObj ) ) {
        value = [];
        cell = uwPropertySvc.createViewModelProperty( key, displayName, classifyAdminConstants.STRING_ARRAY, value.toString(), value.toString() );
        uwPropertySvc.setIsArray( cell, true );

        if( valueObj && valueObj.length > 0 ) {
            uwPropertySvc.setArrayLength( cell, valueObj.length );
            for( var i = 0; i < valueObj.length; i++ ) {
                //take name and entry pair out
                // Name : Value
                var temp = valueObj[ i ];
                var name = '';
                if( temp.hasOwnProperty( classifyAdminConstants.NAME ) ) {
                    name = temp.Name;

                    if( temp.hasOwnProperty( 'Value' ) ) {
                        name = name + ':' + temp.Value;
                    }
                }
                cell.dbValue.push( name );
                cell.displayValues.push( name );
                cell.displayValsModel.push( { displayValue: name } );
            }
        }
    } else if( typeof valueObj === 'object' && valueObj !== null ) {
        value = classifyAdminUtil.getValue( valueObj );
        cell = uwPropertySvc.createViewModelProperty( key, displayName, '', value.toString(), value.toString() );
        cell.uiValue = value.toString();
    } else {
        //string and empty value
        if( valueObj === undefined ) {
            valueObj = '';
        }
        if( key === classifyAdminConstants.IS_HIDE_KEYS && ( valueObj === undefined || valueObj === '' ) ) {
            valueObj = 'false';
        }
        value = valueObj;
        cell = uwPropertySvc.createViewModelProperty( key, displayName, '', value.toString(), value.toString() );
        cell.uiValue = value.toString();
    }

    uwPropertySvc.setEditable( cell, false );
    arr.push( cell );
};

/**
 * Populates the metaData properties to be shown in secondary work area for given selection
 * @param {Object} data Declarative view model
 * @param {Object} selected  Selected object in primary work area
 * @param {String} type type of object
 * @param {Object} subPanelContext sub panel context object
 * @returns {Object} response
 */
export let selectNode = function( data, selected, type, subPanelContext ) {
    if( selected !== undefined ) {
        if( !selected.type ) {
            selected.type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;
        }

        var tmpState = subPanelContext.searchState.value;
        tmpState.propertiesSWA = {};
        var request = {
            jsonRequest: getJsonRequestForIRDI( selected.id, selected.type )
        };

        return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
            var metaDataDef;
            var metaData;

            metaDataDef = classifyAdminUtil.parseJsonForObjectDefinitions( response.out );
            metaData = metaDataDef[ selected.id ];
            if( metaDataDef.displayNames !== undefined ) {
                metaData.displayNames = metaDataDef.displayNames;
            }

            //Array support for metric and non-metric support
            var plainProperties = [];
            var dataTypeMetric = [];
            var dataTypeNonMetric = [];

            //DataType & classType
            //classes do not contain datatype, hence capturing classtype.
            var dataTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );
            var classTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE );

            var arrMetaData = [];
            if( isClassType( classTypeVal ) ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_CLASS_PROP;
            } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_KEYLOV_PROP;
            } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_PROP;
            } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_CLASS_NODE;
            }

            _.forEach( arrMetaData, function( key ) {
                createSWAProperty( metaData, key, plainProperties );
            } );

            var valueObj;
            tmpState.propertiesSWA = {};
            if( dataTypeVal === undefined &&
                classTypeVal === undefined && selected.type !== classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
                performOperationsForKeyLOVDefinition( metaData, plainProperties, subPanelContext );
            } else if( dataTypeVal !== '' && classTypeVal === undefined ) {
                //DataType
                valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );
                if( valueObj !== undefined && metaData.displayNames !== undefined ) {
                    valueObj.displayNames = metaData.displayNames;
                }
                buildDataType( valueObj, dataTypeMetric, dataTypeNonMetric, subPanelContext );
                tmpState.propertiesSWA.currentSecData = plainProperties;
                tmpState.propertiesSWA.dataTypeMetric = dataTypeMetric;
                tmpState.propertiesSWA.dataTypeNonMetric = dataTypeNonMetric;
            }

            if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
                tmpState.propertiesSWA.currentSecData = plainProperties;

                var results = performOperationsForClassDefinition( metaData, data, type, selected );
                tmpState.propertiesSWA.aspects = results.aspects;
                tmpState.propertiesSWA.property = results.property;
                tmpState.propertiesSWA.classAttributes = results.classAttributes;
                tmpState.propertiesSWA.hasClassAttributes = Boolean( data.classAttributes );
                tmpState.propertiesSWA.referenceLinks = results.referenceLinks;
                tmpState.propertiesSWA.attrSelected = false;
            } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
                tmpState = performOperationsForNodeDefinition( data, metaData, selected, response, tmpState );
            }
            tmpState.isTreeExpanding = false;
            if( selected.type !== classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
                subPanelContext.searchState.update( tmpState );
            }
        } );
    }
    if( !subPanelContext.searchState.isTreeExpanding ) {
        resetSWAData( subPanelContext );
    }
};

/**
 * Following method performs the node definitions specific operations in secondary work area
 * @param {Object} data Declarative view model
 * @param {Object} metaData The response object
 * @param {Object} selected Selected object
 * @param {Object} response The response object
 * @param {Object} tmpState temporary sub panel context's searchState
 * @returns {Object} modified temporary searchState
 */
let performOperationsForNodeDefinition = function( data, metaData, selected, response, tmpState ) {
    var parentProp = [];
    var appClassProp = [];
    var valueObj;
    data.caption = data.i18n.properties;

    //Check if it is a storage class
    valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.NODE_PARENT );
    if( valueObj ) {
        _.forEach( classifyAdminConstants.ARR_METADATA_NODE_PARENT, function( key ) {
            valueObj.displayNames = metaData.displayNames;
            createSWAProperty( valueObj, key, parentProp );
        } );
        tmpState.propertiesSWA.parentProp = parentProp;
    }

    var NodeIdClassId = {};
    var tmpNodeId = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.NODE_ID );
    tmpNodeId = {
        type: classifyAdminConstants.NODE_APP_CLASS_TYPE,
        id: tmpNodeId
    };
    //check if it is an Application class
    valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.NODE_APP_CLASS );
    if( valueObj !== undefined ) {
        NodeIdClassId = {
            type: classifyAdminConstants.JSON_REQUEST_TYPE_CLASS,
            id: ''
        };
        _.forEach( classifyAdminConstants.ARR_METADATA_NODE_APP_CLASS, function( key, index ) {
            if( index === 0 ) {
                NodeIdClassId.id = NodeIdClassId.id + valueObj[ key ].toString() + classifyAdminConstants.NODE_CLASS_ID_HASH;
            } else if( index === 1 ) {
                NodeIdClassId.id = NodeIdClassId.id + classifyAdminConstants.NODE_CLASS_ID + valueObj[ key ].toString() + classifyAdminConstants.NODE_CLASS_ID_HASH;
            } else {
                NodeIdClassId.id += valueObj[ key ].toString();
            }
            createSWAProperty( valueObj, key, appClassProp );
        } );
        tmpState.propertiesSWA.appClassProp = appClassProp;
        tmpState.propertiesSWA.NodeIdClassId = NodeIdClassId;
        tmpState.propertiesSWA.nodeId = tmpNodeId;
        tmpState.appClassData = undefined;
    } else {
        tmpState.propertiesSWA.appClassProp = undefined;
        tmpState.appClassData = {};
        //Abstract classes do not have application class.
        //SML nodes do not have ID. Only CST nodes have them
        tmpState.appClassData.isGroupNode = true;
        tmpState.appClassData.isCSTNode = false;
        let param = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.ID );
        if ( param !== undefined ) {
            tmpState.appClassData.isCSTNode = true;
        }
    }
    tmpState.propertiesSWA.selectedObject = selected;

    var imageInfo = classifyAdminUtil.getImageFileTickets( response.out );
    tmpState.propertiesSWA.hasImages = imageInfo.hasImages;
    tmpState.propertiesSWA.selectedUid = imageInfo.puid;
    tmpState.selectedPropertyGroup = null;

    return tmpState;
};

/**
 * Following method performs the class definitions specific operations in secondary work area
 * @param {Object} metaData The response object
 * @param {Object} data Declarative view model
 * @param {String} type Type
 * @param {Object} selected Selected object
 * @Returns {Object} class definition
 */
export let performOperationsForClassDefinition = function( metaData, data, type, selected ) {
    var aspects = [];
    var property = [];
    var classAttributes = {};
    var referenceLinks = {};
    //class attributes
    buildClassAttributesTable( metaData, data, aspects, property, type, classAttributes, referenceLinks );
    return {
        aspects: aspects,
        property: property,
        classAttributes: classAttributes,
        referenceLinks: referenceLinks
    };
};

/**
 * Following method performs the KeyLOV definition specific operations
 * @param {Object} metaData The response object
 * @param {Array} plainProperties Collection of view model properties
 * @param {Object} subPanelContext sub panel context object
 */
export let performOperationsForKeyLOVDefinition = function( metaData, plainProperties, subPanelContext ) {
    //it means it's keyLOV
    var lovItems = metaData[ classifyAdminConstants.KEYLOV_LOVITEMS ];
    if( metaData !== undefined && metaData.displayNames !== undefined ) {
        lovItems.displayNames = metaData.displayNames;
    }

    var tmpState = subPanelContext.searchState.value;
    tmpState.propertiesSWA.currentSecData = plainProperties;

    createSWAProperty( lovItems, classifyAdminConstants.DATA_TYPE, plainProperties );
    var dataT = classifyAdminUtil.getObjectAsPerKey( lovItems, 'DataType' );
    tmpState.propertiesSWA.dataType = dataT;
    var key = classifyAdminConstants.JSON_RESPONSE_LOV + dataT + classifyAdminConstants.JSON_RESPONSE_ITEMS;
    var LOVTypeItems = lovItems[ key ];
    if( !Array.isArray( LOVTypeItems ) ) {
        var arr = [];
        arr.push( classifyAdminUtil.getObjectAsPerKey( LOVTypeItems, 'False' ) );
        arr.push( classifyAdminUtil.getObjectAsPerKey( LOVTypeItems, 'True' ) );
        tmpState.propertiesSWA.lovTypeItems = arr;
    } else {
        tmpState.propertiesSWA.lovTypeItems = LOVTypeItems;
    }
    subPanelContext.searchState.update( tmpState );
};

export let selectNodeForNode = function( data, selected ) {
    if ( !selected ) {
        return null;
    }
    var request = {
        jsonRequest: getJsonRequestForIRDI( selected.id, selected.type )
    };

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var metaDataDef;
        var metaData;

        metaDataDef = classifyAdminUtil.parseJsonForObjectDefinitions( response.out );
        metaData = metaDataDef[ selected.id ];
        if( metaDataDef.displayNames !== undefined ) {
            metaData.displayNames = metaDataDef.displayNames;
        }

        //Array support for metric and non-metric support
        var plainProperties = [];

        //DataType & classType
        //classes do not contain datatype, hence capturing classtype.
        var classTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE );

        var arrMetaData = [];
        if( isClassType( classTypeVal ) ) {
            arrMetaData = classifyAdminConstants.ARR_METADATA_NODE_APP_CLASS_JSON;
        }

        _.forEach( arrMetaData, function( key ) {
            createSWAProperty( metaData, key, plainProperties );
        } );

        return plainProperties;
    } );
};
/** To - Do : Refactors the below method for better purpose
 * Following method populates the data for panel
 * @param {Object} data Declarative view model
 * @param {Object} subPanelContext sub panel context
 * @returns {Object} response
 */
export let selectNodeForPanel = function( data, subPanelContext ) {
    if( data.reference !== null ) {
        var request = {
            jsonRequest: getJsonRequestForIRDI( data.reference.id, data.reference.type )
        };

        return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
            var metaDataDef;
            var metaData;

            metaDataDef = classifyAdminUtil.parseJsonForObjectDefinitions( response.out );
            metaData = metaDataDef[ data.reference.id ];
            if( metaDataDef.displayNames !== undefined ) {
                metaData.displayNames = metaDataDef.displayNames;
            }

            var plainProperties = [];
            var dataTypeMetric = [];
            var dataTypeNonMetric = [];

            var arrMetaData = [];
            if( data.reference.type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_CLASS_PROP;
            } else if( data.reference.type === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_KEYLOV_PROP;
            }

            _.forEach( arrMetaData, function( key ) {
                createSWAProperty( metaData, key, plainProperties );
            } );

            //DataType
            var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );

            if( classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE ) === undefined &&
                classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE ) === undefined
            ) {
                //Tricky : we need aw-tree hence we need to do this way
                buildDataType( valueObj, dataTypeMetric, dataTypeNonMetric, subPanelContext );
            } else if( classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE ) !== '' ||
                classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE ) !== '' ) {
                buildDataType( valueObj, dataTypeMetric, dataTypeNonMetric, subPanelContext );
            }

            if( data.reference.type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
                var Panelaspects = [];
                var Panelproperty = [];
                var classAttributes = [];
                var referenceLinks = {};

                buildClassAttributesTable( metaData, data, Panelaspects, Panelproperty, 'AttributesPanel', classAttributes, referenceLinks );

                var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_ATTRIBUTE );

                data.classAttributesResponseForPanel = valueObj;
            }
            //class attributes
            data.currentSecDataPanel = plainProperties;

            var tmpState = { ...subPanelContext.searchState.value };
            tmpState.reference = data.reference;
            tmpState.currentSecDataPanel = plainProperties;
            tmpState.Panelaspects = Panelaspects;
            tmpState.Panelproperty = Panelproperty;
            tmpState.classAttributesResponseForPanel = valueObj;
            tmpState.PanelClassAttributes = classAttributes;

            if( data.reference.isLink === true ) {
                tmpState.isLinkClicked = true;
            }
            subPanelContext.searchState.update( tmpState );
        } );
    }
};

/**
 * Following method builds the table for attributes
 * @param {Object} metaData Object representation for data
 * @param {Object} data Declarative view model
 * @param {Array} aspects list of aspects
 * @param {Array} property list of property definitions
 * @param {Object} type type
 * @param {Object} classAttributes list of class attributes
 * @param {Object} referenceLinks reference Links
 */
export let buildClassAttributesTable = function( metaData, data, aspects, property, type, classAttributes, referenceLinks ) {
    buildClassAttributeList( metaData, data, aspects, property, classAttributes, referenceLinks );
    if( type !== 'Attributes' ) {
        eventBus.publish( 'entryGridForPanel.plTable.reload' );
    }
};

/**
 * Following method deals with processing for selected attribute
 * @param {Object} data Declarative view model
 * @param {Object} selected selected attribute in the table
 * @param {Object} subPanelContext sub panel context
 * @returns {Object} promise
 */
export let selectNodeInSecWorkArea = function( data, selected, subPanelContext ) {
    var tmpState = subPanelContext.searchState.value;
    if(  tmpState.isLinkClicked === true ) {
        tmpState.isLinkClicked = false;
        tmpState.currentSecDataPanel = [];
        tmpState.classAttributesResponseForPanel = [];
        tmpState.keyLOVTreeDataMetric = [];
        tmpState.reference = {};
        subPanelContext.searchState.update( tmpState );
    }


    data.attrprop = [];
    data.reference = {};

    if( selected.length === 0 ) {
        return {
            attrSelected: false,
            attrprop: [],
            reference: null
        };
    }

    var attrprop = data.classAttributes[ selected[ 0 ].id ].slice();

    _.forEach( attrprop, function( item ) {
        if( item.propertyName === 'Type' ) {
            selected[ 0 ].type = item.value;
        }
    } );

    if( selected[ 0 ].type === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT ) {
        var txt = 'Associated Class:' + selected[ 0 ].id;
        var cell = uwPropertySvc.createViewModelProperty( 'Reference', 'Reference', '', txt.toString(), txt.toString() );
        cell.uiValue = txt.toString();

        data.reference = cell;
        data.reference.isLink = true;
        data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;
        data.reference.id = selected[ 0 ].id;
        data.attrprop = attrprop;
        return {
            attrSelected: true,
            attrprop: attrprop,
            reference: data.reference
        };
    }
    var deferred = AwPromiseService.instance.defer();
    var request = {
        jsonRequest: getJsonRequestForIRDI( selected[ 0 ].id, 'PropertyDefinition' )
    };

    soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var metaDataDef;
        var metaData;

        metaDataDef = classifyAdminUtil.parseJsonForObjectDefinitions( response.out );
        metaData = metaDataDef[ selected[0].id ];
        if( metaDataDef.displayNames !== undefined ) {
            metaData.displayNames = metaDataDef.displayNames;
        }

        //Array support for metric and non-metric support
        var plainProperties = [];
        var dataTypeMetric = [];
        var dataTypeNonMetric = [];

        _.forEach( classifyAdminConstants.ARR_METADATA_PROP, function( key ) {
            createSWAProperty( metaData, key, plainProperties );
        } );

        _.forEach( plainProperties, function( item ) {
            attrprop.push( item );
        } );

        data.attrprop = attrprop;

        //To-Do, Metric and non-metric units and values is issue
        if( classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE ) !== '' ||
            classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE ) !== '' ) {
            //DataType
            var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );

            buildDataType( valueObj, dataTypeMetric, dataTypeNonMetric, subPanelContext );
        }

        //KeyLOV
        if( valueObj && valueObj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_KEYLOV ) ) {
            var value = classifyAdminUtil.getObjectAsPerKey( valueObj, classifyAdminConstants.DATA_TYPE_KEYLOV );

            //Hyper-link
            var link = [];
            var txt = classifyAdminConstants.ASSOCIATED_METRIC_KEYLOV + ':' + value.toString();
            var cell = uwPropertySvc.createViewModelProperty( 'KeyLOV', 'KeyLOV', '',
                txt.toString(), txt.toString() );

            cell.uiValue = txt.toString();
            data.reference = cell;
            data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV;
            data.reference.isLink = true;
            data.reference.id = value;
        }

        //Reference
        if( valueObj && valueObj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE ) ) {
            var value = classifyAdminUtil.getObjectAsPerKey( valueObj, classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE );

            var arr = classifyAdminUtil.splitIRDI( value );

            //2nd position is of Object type - ID
            var objectType = arr[ 1 ].split( '-' );
            var txt = null;
            var cell = null;
            //Hyper-link
            var link = [];
            if( objectType[ 0 ] === classifyAdminConstants.CLASS_DEFINITION_OBJECT_TYPE ) {
                txt = 'Associated Class:' + value;
                cell = uwPropertySvc.createViewModelProperty( 'Reference', 'Reference', '', txt.toString(), txt.toString() );
                cell.uiValue = txt.toString();
                data.reference = cell;
                data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;

                data.reference.isLink = true;
                data.reference.id = value;
            } else {
                var txt = classifyAdminConstants.ASSOCIATED_METRIC_KEYLOV + ':' + value.toString();
                cell = uwPropertySvc.createViewModelProperty( 'KeyLOV', 'KeyLOV', '',
                    txt.toString(), txt.toString() );
                cell.uiValue = txt.toString();
                data.reference = cell;
                data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV;
                data.reference.isLink = true;
                data.reference.id = value;
            }
        }

        deferred.resolve( {
            attrSelected: true,
            attrprop: attrprop,
            reference: data.reference
        } );
    } );
    return deferred.promise;
};

/**
 * Builds the class attributes list
 * @param {Object} metaData Object representation of SWA properties
 * @param {Object} data Declarative view model
 * @param {Object} aspects aspects
 * @param {Object} property property
 * @param {Object} classAttributes class attributes
 * @param {Object} referenceLinks reference links
 */
export let buildClassAttributeList = function( metaData, data, aspects, property, classAttributes, referenceLinks ) {
    var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_ATTRIBUTE );

    data.classAttributes = valueObj;
    if( valueObj && Array.isArray( valueObj ) && valueObj.length > 0 ) {
        //class attributes are exists
        for( var i = 0; i < valueObj.length; i++ ) {
            buildClassAttribute( metaData, valueObj[ i ], aspects, property, classAttributes, referenceLinks );
        }
    }
};

/**
 * Following method builds the list of class attributes IRDI's
 * @param {Object} metaData Object containing class attributes data and displayNames
 * @param {Object} obj Object containing class attributes data
 * @param {Object} aspects aspects
 * @param {Object} property property
 * @param {Object} classAttributes class attributes
 * @param {Object} referenceLinks reference links
 */
export let buildClassAttribute = function( metaData, obj, aspects, property, classAttributes, referenceLinks ) {
    var plainProperties = [];
    if( metaData.displayNames !== undefined ) {
        obj.displayNames = metaData.displayNames;
    }

    var link = [];
    _.forEach( classifyAdminConstants.ARR_ATTRIBUTE_PROP, function( key ) {
        createSWAProperty( obj, key, plainProperties );
    } );

    var type = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.CLASS_ATTRIBUTE_TYPE );

    createSWAProperty( obj, 'Reference', link );

    if( type === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT ) {
        buildAttribute( aspects, obj.Reference );
        link[ 0 ].type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;
    } else if( type === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_PROPERTY ) {
        buildAttribute( property, obj.Reference );
        link[ 0 ].type = classifyAdminConstants.JSON_REQUEST_TYPE_PROP;
    }

    classAttributes[ obj.Reference ] = plainProperties;
    referenceLinks[ obj.Reference ] = link[ 0 ];
};

/**
 * Creates entry within the specified array
 * @param {Object} arr collection of attributes
 * @param {*} entry entry within the array to be added
 */
export let buildAttribute = function( arr, entry ) {
    arr.push( entry );
};

/**
   * Wrapper method for data types
   * @param {*} obj  Supplied Object
   * @param {*} arr Output Array 1
   * @param {*} arr2 Output Array 2
   * @param {Object} subPanelContext sub panel context

   */
export let buildDataType = function( obj, arr, arr2, subPanelContext ) {
    var dataType;
    var value;
    if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_TYPE ) ) {
        createSWAProperty( obj, classifyAdminConstants.DATA_TYPE_TYPE, arr );
        value = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.DATA_TYPE_TYPE );
        dataType = value;
    } else {
        value = '';
    }

    //StringDataType
    if( dataType === classifyAdminConstants.DATA_TYPE_STRING ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_STRING, null, subPanelContext );
    } else if( dataType === classifyAdminConstants.DATA_TYPE_INTEGER ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_INTEGER, classifyAdminConstants.DATA_TYPE_METRIC_FORMAT, subPanelContext );

        //Non - Metric Format
        if( obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) ) {
            buildNativeDataType( obj[ classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ], arr2, dataType, classifyAdminConstants.ARR_DATA_TYPE_INTEGER,
                classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT, subPanelContext );
        }
    } else if( dataType === classifyAdminConstants.DATA_TYPE_DOUBLE ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_DOUBLE, classifyAdminConstants.DATA_TYPE_METRIC_FORMAT, subPanelContext );
        //Non-metric Format
        if( obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) ) {
            buildNativeDataType( obj[ classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ], arr2, dataType, classifyAdminConstants.ARR_DATA_TYPE_DOUBLE,
                classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT, subPanelContext );
        }
    } else if( dataType === classifyAdminConstants.DATA_TYPE_BOOLEAN ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_BOOLEAN, null, subPanelContext );
    } else if( dataType === classifyAdminConstants.DATA_TYPE_REFERENCE ) {
        buildReferenceDataType( obj, arr, subPanelContext );
    } else if( dataType === classifyAdminConstants.DATA_TYPE_POSITION ||
        dataType === classifyAdminConstants.DATA_TYPE_AXIS ||
        dataType === classifyAdminConstants.DATA_TYPE_VALUE_RANGE ||
        dataType === classifyAdminConstants.DATA_TYPE_VALUE_WITH_TOLERANCE ||
        dataType === classifyAdminConstants.DATA_TYPE_LEVEL ) {
        buildComplexDataType( obj, arr );
        if( obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) ) {
            buildComplexDataType( obj[ classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ], arr2 );
        }
    }
};

/**
 * Following method builds complex data type
 * @param {Object} obj Supplied Object
 * @param {Array} arr Output Array
 */
export let buildComplexDataType = function( obj, arr ) {
    createSWAProperty( obj, classifyAdminConstants.DATA_TYPE_UNIT, arr );
};

/**
 * Method builds the reference data type
 * @param {Object} obj  Supplied Object
 * @param {Array} arr Output array
 * @param {Object} subPanelContext sub panel context object
 */
export let buildReferenceDataType = function( obj, arr, subPanelContext ) {
    var value = classifyAdminConstants.DATA_TYPE_REFERENCE;
    var dataType = classifyAdminConstants.DATA_TYPE_REFERENCE;

    _.forEach( classifyAdminConstants.ARR_DATA_TYPE_REF, function( key ) {
        createSWAProperty( obj, key, arr );
    } );

    //KeyLOV
    if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE ) ) {
        value = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE );

        //check its keylOv
        var arr = classifyAdminUtil.splitIRDI( value );
        var objectType = null;
        if( arr.length > 0 ) {
            objectType = arr[ 1 ].split( '-' );
        }

        var system = classifyAdminConstants.DATA_TYPE_METRIC_FORMAT;

        if( objectType && objectType.length > 0 && objectType[ 0 ] === '09' ) {
            getKeyLOV( value, dataType, system, subPanelContext );
        }
    }
};

/**
   * Method builds the boolean data type
   * @param {Object} obj Supplied Object
   * @param {Array} arr Resultant array
   * @param {String} dataType Supplied Data Type
   * @param {String} arrKey array key
   * @param {String} system sytem
   * @param {Object} subPanelContext subpanel context
   */
export let buildNativeDataType = function( obj, arr, dataType, arrKey, system, subPanelContext ) {
    var value = dataType;

    _.forEach( arrKey, function( key ) {
        createSWAProperty( obj, key, arr );
    } );

    //KeyLOV
    if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_KEYLOV ) ) {
        value = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.DATA_TYPE_KEYLOV );
        getKeyLOV( value, dataType, system, subPanelContext );
    }
};

/**
 * Update objects for search
 *
 * @param {Object} parents parents
 * @param {Object} objectSet set of objects
 * @param {String} type object type
 * @param {Object} parentNode parentNode
 * @returns {Object} updated set
 */
let updateObjectsForSearch = function( parents, objectSet, type, parentNode ) {
    var newSet = [];
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    _.forEach( objectSet, function( object ) {
        if( object.parents && object.parents.length > 0 ) {
            var tmpParents = [];
            _.forEach( object.parents, function( parent ) {
                var parentDetails = parents[ parent ];
                parentDetails.ID = type === classifyAdminConstants.CLASSES ? parentDetails.IRDI : parentDetails.NodeId;
                parentDetails.imageIconUrl = addImage( parentDetails, type, parentDetails.ClassType );
                if( parentDetails.SourceStandard ) {
                    var displayName = getReleaseDisplayName( adminCtx.releases, parentDetails.SourceStandard );
                    if( parentDetails.Name.indexOf( displayName ) === -1 ) {
                        parentDetails.Name += ' (' + displayName + ' )';
                    }
                }
                tmpParents.push( parentDetails );
            } );
            object.parents = tmpParents;
        }
        if( !parentNode || parentNode.uid === classifyAdminConstants.TOP ||
            object.parents && object.parents[ 0 ] === parentNode.uid ||
            _isNextPage ) {
            newSet.push( object );
        }
    } );
    return newSet;
};

/**
 * Updates objects for sublocation
 *
 * @param {Object} origSet original set
 * @param {Object} origFound original found
 * @param {String} newSet new set
 * @param {Object} dataProvider data provider
 * @return {Object} updated original set
 */
let updateObjectsForSummary = function( origSet, origFound, newSet, dataProvider ) {
    var isNextPage = dataProvider.startIndex > 0;
    origSet = updateObjects( origSet, newSet, isNextPage );
    dataProvider.viewModelCollection.setViewModelObjects( origSet );
    dataProvider.viewModelCollection.totalFound = origFound;
    return origSet;
};

/**
 * Updates objects for sublocation
 *
 * @param {Object} parents parents
 * @param {Object} data view model
 * @param {Object} origSet original set
 * @param {Object} origFound original found
 * @param {String} newSet new set
 * @param {String} type column
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @return {Object} updated set
 */
let updateObjectsForSublocation = function( parents, data, origSet, origFound, newSet, type, parentNode, isSearch ) {
    data.tmpObjectsFound = origFound;
    data.tmpObjects = newSet;
    var objects = [];
    if( !isSearch ) {
        objects = newSet;
    } else {
        objects = updateObjectsForSearch( parents, newSet, type, parentNode );
    }
    // var isNextPage = data.treeLoadInput && data.treeLoadInput.startChildNdx > 0;
    if( parentNode && parentNode.uid !== classifyAdminConstants.TOP && !_isNextPage ) {
        data.children = newSet;
    } else {
        origSet = updateObjects( origSet, objects, _isNextPage );
        data.tmpObjectsLoaded = origSet.length;
        data.data.tmpObjectsLoaded = origSet.length;
        return origSet;
    }
};

/**
 * Parses response for each object type and sets data providers
 *
 * @param {Object} response SOA response
 * @param {Object} data view model
 * @param {String} type column
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 */
export let getJsonResponseForType = function( response, data, type, parentNode, isSearch ) {
    var isSummary = type === 'Summary';
    var numString = '';
    var typeString;
    var newSet;

    if( type === classifyAdminConstants.CLASSES || isSummary ) {
        var classDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.CLASSES, isSummary, isSearch );
        typeString = data.i18n.classesTitle;
        data.classesFound = classDefs.totalFound;
        data.classesLoaded = classDefs.totalLoaded;
        var tmpClasses = getObjects( classDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS );
        if( !isSubLocation ) {
            numString = Number( data.classesFound ).toLocaleString();
            data.data.classesTitle = data.i18n.classesTitle + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.classes, data.classesFound, tmpClasses, data.dataProviders.classes );
            }
            data.classes = tmpClasses;
        } else {
            newSet = updateObjectsForSublocation( classDefs.parents, data, data.classes, data.classesFound, tmpClasses, type,
                parentNode, isSearch );
            if( newSet ) {
                data.classes = newSet;
            }
        }
        data.data.classes = data.classes;
        data.data.classesLoaded = data.classesLoaded;
        data.data.classesFound = data.classesFound;
    }

    if( type === classifyAdminConstants.PROPERTIES || isSummary ) {
        var propDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.PROPERTIES, isSummary );
        typeString = data.i18n.propertiesTitle;
        data.propsFound = propDefs.totalFound;
        data.propsLoaded = propDefs.totalLoaded;

        //object collection of entries
        data.allPropDefs = classifyAdminUtil.parseJsonForObjectDefinitions( response.out );

        var tmpProps = getObjects( propDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_PROP );

        if( !isSubLocation ) {
            numString = Number( data.propsFound ).toLocaleString();
            data.data.propsTitle = data.i18n.propertiesTitle + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.properties, data.propsFound, tmpProps, data.dataProviders.properties );
            }
            data.properties = tmpProps;
        } else {
            data.properties = updateObjectsForSublocation( propDefs.parents, data, data.properties, data.propsFound, tmpProps, type, parentNode, isSearch );
        }

        data.data.properties = data.properties;
        data.data.propsLoaded = data.propsLoaded;
        data.data.propsFound = data.propsFound;
    }
    if( type === classifyAdminConstants.KEYLOV || isSummary ) {
        var keylovDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.KEYLOV, isSummary );
        var tmpKeylovs = getObjects( keylovDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV );
        typeString = data.i18n.keylovTitle;
        data.keylovFound = keylovDefs.totalFound;
        data.keylovLoaded = keylovDefs.totalLoaded;

        if( !isSubLocation ) {
            numString = Number( data.keylovFound ).toLocaleString();
            data.data.keylovTitle = data.i18n.keylovTitle + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.keylovs, data.keylovFound, tmpKeylovs, data.dataProviders.keylov );
            }

            data.keylovs = tmpKeylovs;
        } else {
            data.keylovs = updateObjectsForSublocation( keylovDefs.parents, data, data.keylovs, data.keylovFound, tmpKeylovs, type, parentNode, isSearch );
        }

        data.data.keylovs = data.keylovs;
        data.data.keylovLoaded = data.keylovLoaded;
        data.data.keylovFound = data.keylovFound;
    }
    if( type === classifyAdminConstants.NODES || isSummary ) {
        var nodeDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.NODES, isSummary, isSearch );
        data.nodesFound = nodeDefs.totalFound;
        data.nodesLoaded = nodeDefs.totalLoaded;
        var tmpNodes = getObjects( nodeDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_NODE );
        typeString = data.i18n.nodesTitle;
        if( !isSubLocation ) {
            numString = Number( data.nodesFound ).toLocaleString();
            data.data.nodesTitle = data.i18n.nodesTitle + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.nodes, data.nodesFound, tmpNodes, data.dataProviders.nodes );
            }
            data.nodes = tmpNodes;
        } else {
            newSet = updateObjectsForSublocation( nodeDefs.parents, data, data.data.nodes, data.nodesFound, tmpNodes, type,
                parentNode, isSearch );
            if( newSet ) {
                data.nodes = newSet;
            }
        }
        data.data.nodes = data.nodes;
        data.data.nodesLoaded = data.nodesLoaded;
        data.data.nodesFound = data.nodesFound;
    }
    if( isSubLocation && ( !parentNode || parentNode.uid === classifyAdminConstants.TOP || isSearch ) ) {
        updateBreadCrumb( data, typeString, isSearch );
    }
};

/**
 * Updates the breadcrumb if required and
 *
 * @param {Object} data data to extract information from to update breadcrumb.
 * @param {String} typeString type of classification item to represent in breadcrumb.
 * @param {Boolean} isSearch classification display is displaying search or filter results. Optional
 */
export let updateBreadCrumb = function( data, typeString, isSearch ) {
    var searchString = typeString;
    if( isSearch && data.searchBox.dbValue ) {
        searchString = data.searchBox.dbValue;
    }
    var andString = ' ' + data.i18n.and;

    var selected = getSelectedReleases( data );

    if( selected.length > 0 ) {
        searchString += andString + ' ';
        var releaseStr = data.i18n.releases + ': ';
        _.forEach( selected, function( release, idx ) {
            if( idx > 0 ) {
                releaseStr += ', ';
            }
            releaseStr += release.propDisplayValue;
        } );
        searchString += releaseStr;
    }
    if( data && data.subPanelContext && data.subPanelContext.searchState && data.subPanelContext.searchState.filterMap && data.subPanelContext.searchState.filterMap.length > 0 ) {
        searchString += andString + ' ';
        for( var filter of data.subPanelContext.searchState.filterMap ) {
            searchString = searchString + ' ' + filter[ 0 ] + ': ' + filter[ 1 ];
            if( filter !== data.subPanelContext.searchState.filterMap[ data.subPanelContext.searchState.filterMap.length - 1 ] ) {
                searchString += andString;
            }
        }
    }
    data.breadCrumbInfo.searchString = searchString;
    data.breadCrumbInfo.totalFound = data.tmpObjectsFound;
};

/**
 * Following method calls SOA to get admin objects
 * TODO: Nodes
 *
 * @param {Object} data view model
 * @param {String} type column
 * @return {Objects} soa response
 */
export let getAdminObjects = function( data, type ) {
    isSubLocation = false;

    var request = {
        jsonRequest: getJsonRequestForSearch( data, type )
    };

    var ctx = appCtxService.getCtx( 'clsAdmin' );
    if( !ctx ) {
        ctx = {};
        ctx.releases = {};
        appCtxService.registerCtx( 'clsAdmin', ctx );
    }
    ctx.soaSupported = true;

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        getJsonResponseForType( response, data, type );

        //update charts in dashboard
        if( type === 'Summary' ) {
            createChart( data );
        }
        //clear import data
        ctx.import = {};
        appCtxService.updateCtx( 'clsAdmin', ctx );
    }, function( soaData ) {
        ctx.soaSupported = false;
        notyService.showError( data.i18n.noSOAError );
    } );
};

/**
 * Following method calls SOA to get admin objects
 * TODO: Nodes
 *
 * @param {Object} data view model
 * @param {String} type column
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @return {Json} json response
 */
export let getAdminObjectsForSublocation = function( data, type, parentNode, isSearch ) {
    isSubLocation = true;
    //clear import data
    var ctx = appCtxService.getCtx( 'clsAdmin' );
    if( ctx ) {
        ctx.import = {};
    } else {
        ctx = {};
    }
    ctx.currentType = data.tableSummaryDataProviderName;
    appCtxService.updateCtx( 'clsAdmin', ctx );
    var request = {
        jsonRequest: getJsonRequestForSearch( data, type, parentNode, isSearch )
    };

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        getJsonResponseForType( response, data, type, parentNode, isSearch );

        var response1 = {};
        response1 = {
            objects: data.tmpObjects,
            totalFound: data.tmpObjectsFound
        };

        var isNextPage = false;
        if( data && data.treeLoadInput ) {
            isNextPage = data.treeLoadInput.startChildNdx > 0;
        }

        if( isSearch && !data.treeLoadInput.parentNode._expandRequested && !isNextPage ) {
            resetSWAData();
        }

        return response1;
    }, function( soaData ) {
        notyService.showError( data.i18n.noSOAError );
    } );
};

/**
 * Following method creates the column chart
 * @param {*} data view model
 */
export let createChart = function( data ) {
    //Initializing var for chart display and
    //on select function to redirect to correct chart.
    var chartProvider = {
        title: '',
        columns: [],
        onSelect: function( column ) { exports.barSelection( column ); }
    };

    if( data.data.nodesFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.nodesTitle, value: data.data.nodesFound, key: NODES } );
    }

    if( data.data.classesFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.classesTitle, value: data.data.classesFound, key: CLASSES } );
    }

    if( data.data.propsFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.propertiesTitle, value: data.data.propsFound, key: PROPERTIES } );
    }

    if( data.data.keylovFound !== 0 ) {
        chartProvider.columns.push( { label: data.i18n.keylovTitle, value: data.data.keylovFound, key: KEYLOV } );
    }

    data.data.chartProvider = chartProvider;
};

/**
 * Following method redirects to the appropriate tab based on the column chart
 * that is selected.
 * @param {*} column column
 */
export let barSelection = function( column ) {
    var stateSvc = AwStateService.instance;
    if( column.key === NODES ) {
        stateSvc.go( NODES, {}, {} );
    }
    if( column.key === CLASSES ) {
        stateSvc.go( CLASSES, {}, {} );
    }
    if( column.key === PROPERTIES ) {
        stateSvc.go( PROPERTIES, {}, {} );
    }

    if( column.key === KEYLOV ) {
        stateSvc.go( KEYLOV, {}, {} );
    }
};

/**
 * Following method gets the object names/error status from the ImportClassificationDefinitions soa's response
 * @param {*} objectNamesAndErrorStatus SOA response constaining error status and result
 * @param {*} data view model
 * @return {*} objectNames return all the object names to be displayed
 */
export let getObjectNames = function( objectNamesAndErrorStatus, data ) {
    var objectNamesAndErrorDetails = objectNamesAndErrorStatus.out;
    data.objectNames = new Map();
    var parsedResult = parsingUtils.parseJsonString( objectNamesAndErrorDetails );

    //if it is not partial errors then it could be
    //1. The schema version could be incorrect
    //2. The object type information could be incorrect
    //3. The Status information could be incorrect.
    //4. Empty json file
    if( parsedResult.ErrorDetails !== undefined && parsedResult.ErrorDetails[ 0 ] !== data.i18n.partialErrors ) {
        //system error helps in displaying system error.
        var errorInConsole = parsedResult.ErrorDetails[ 0 ];
        logger.error( errorInConsole );
        data.systemError = true;
        data.errorsExist = true;
        return;
    }

    //if the ErrorDetails contain partial errors then we need to parse through all the object names
    //to display the appropriate error in error icon.
    data.errorsExist = parsedResult.ResultStatus !== 0 && parsedResult.ErrorDetails[ 0 ] === data.i18n.partialErrors;

    var results = parsedResult.Result;

    if( results.length === 0 ) {
        data.objectNames = '';
    } else if( results[ 0 ].Name !== undefined || results[ 0 ].ErrorDetails !== undefined ) {
        data.captionName = getCaptionName( data, results[ 0 ] );
        if( data.captionName === '' ) { return; }
        results.forEach( function( object ) {
            let objectName = object.Name + ' (' + ( object.IRDI ? object.IRDI : object.ID ) + ')';
            if( object.ErrorDetails === undefined ) {
                data.objectNames.set( objectName, '' );
            } else {
                object.ErrorDetails[ 0 ] = object.ErrorDetails[ 0 ].replace( /"/g, '\'' );
                data.objectNames.set( objectName, { extendedTooltipContent: object.ErrorDetails[ 0 ] } );
            }
        } );

        data.objectNames = Array.from( data.objectNames );
    }

    //Save filename, fmsTicket and type for dashboard use
    if( !data.errorsExist ) {
        var ctx = appCtxService.getCtx( 'clsAdmin' );
        ctx.import = {
            fileName: data.fileName,
            fmsTicket: data.fmsTicket,
            importObjectType: data.captionName
        };
        appCtxService.updateCtx( 'clsAdmin', ctx );
    }
    return {
        newObjectNames: data.objectNames,
        newCaptionName: data.captionName,
        errorsExist: data.errorsExist
    };
};

/**
 * Parses through the objectdetails to retrieve the caption name
 * @param {*} data view model
 * @param {*} objectDetails contains the object details
 * @return {String} captionName contains a caption name information
 */
let getCaptionName = function( data, objectDetails ) {
    var stateSvc = AwStateService.instance;
    var pageStatus = stateSvc.current.name;
    var captionName;

    let objectType = objectDetails.IRDI ? objectDetails.IRDI.substring( objectDetails.IRDI.indexOf( '#' ) + 1, objectDetails.IRDI.indexOf( '-', objectDetails.IRDI.indexOf( '#' ) ) ) : undefined;
    switch ( objectType ) {
        case '09':
            captionName = data.i18n.keylovTitle;
            break;
        case '02':
            captionName = data.i18n.propertiesTitle;
            break;
        case '01':
            captionName = data.i18n.classesTitle;
            break;
        case undefined:
            captionName = data.i18n.nodesTitle;
            break;
    }

    data.captionName = captionName;
    return data.captionName;
};

/**
 * This is
 * @param {Object} data - the data object
 * @param {String} viewName - name of the aw-command-panel-section
 * @param {Boolean} isCollapsed - collapsed state of aw-command-panel-section
 */
export let expandOrCollapseSummary = function( data, viewName, isCollapsed ) {
    if( viewName === 'clsSummary' ) {
        data.summaryCollapsed = isCollapsed;
    }
};

/**
  * Following method calls SOA to get admin objects

  * @param {Boolean} isNextPage true if search, false otherwise
  */
export let setNextPage = function( isNextPage ) {
    _isNextPage = isNextPage;
};

/**
 * This is used to set location flag in karma tests
 * @param {Object} isLocation true if location, false otherwise
 */
export let setSublocation = function( isLocation ) {
    isSubLocation = isLocation;
};

/**
 * This is used to set clickedOnImport flag to true
 * @param {Object} data - the data object
 * @returns {boolean} set clickonimport flag to true after import button is clicked
 */
export let uploadAndImport = function( data ) {
    data.clickedOnImport = true;
    return data.clickedOnImport;
};

/**
 * This is used to reset clickedOnImport flag
 * @param {Object} data - the data object
 * @returns {boolean} set clickonimport flag to false after the file imported successfully
 */
export let fileImported = function( data ) {
    data.clickedOnImport = false;
    return data.clickedOnImport;
};

/**
 * Initialize current sec data with the metaData properties in subPanelContext.searchState to be shown in secondary work area for given selection
 * @param {Object} searchState subPanelContext's searchState
 * @param {String} subLocationName sublocation name
 * @returns {Object} result object having SWA data
 */
export let initializeSWA = function( searchState, subLocationName ) {
    var result = {};
    var propertiesSWA = searchState.propertiesSWA;
    var hasProps = propertiesSWA !== undefined && propertiesSWA.currentSecData !== undefined;
    if( hasProps ) {
        result.currentSecData = propertiesSWA.currentSecData;

        if( subLocationName === 'Nodes' ) {
            result.hasImages = propertiesSWA.hasImages;
            result.selectedUid = propertiesSWA.selectedUid;
            result.appClassProp = propertiesSWA.appClassProp;
            result.parentProp = propertiesSWA.parentProp;
        } else {
            result.dataTypeMetric = propertiesSWA.dataTypeMetric;
            result.dataTypeNonMetric = propertiesSWA.dataTypeNonMetric;
            if( subLocationName === 'Classes' ) {
                result.aspects = propertiesSWA.aspects;
                result.property = propertiesSWA.property;
                result.classAttributes = propertiesSWA.classAttributes;
                result.hasClassAttributes = propertiesSWA.hasClassAttributes;
                result.referenceLinks = propertiesSWA.referenceLinks;
                result.attrProp = [];
            }
            if( subLocationName === 'Properties' ) {
                result.dataTypeMetric = propertiesSWA.dataTypeMetric;
                result.dataTypeNonMetric = propertiesSWA.dataTypeNonMetric;
                result.keyLOVTreeDataMetric = propertiesSWA.keyLOVTreeDataMetric;
                result.keyLOVTreeDataNonMetric = propertiesSWA.keyLOVTreeDataNonMetric;
                result.isAvailable = true;
            }
            if( subLocationName === 'KeyLOV' ) {
                result.dataType = searchState.propertiesSWA.dataType;
                result.lovTypeItems = searchState.propertiesSWA.lovTypeItems;
            }
        }
    }
    return result;
};

export let createListForPropertyAndAtrributeSection = function( data, subPanelContext ) {
    let item = { ...subPanelContext.searchState.value };
    return {
        currentSecDataPanel : item.currentSecDataPanel,
        keyLOVTreeDataMetric : item.propertiesSWA.keyLOVTreeDataMetric,
        classAttributesResponseForPanel : item.classAttributesResponseForPanel

    };
};

export let changeFileType = function( fileType ) {
    return fileType.value ? 'Awp0ClsAdminImportSub' : 'ImportPLMXMLSubPanel';
};


export default exports = {
    buildAttribute,
    barSelection,
    buildClassAttributeList,
    buildClassAttributesTable,
    buildClassAttribute,
    buildComplexDataType,
    buildDataType,
    buildLOVForBoolean,
    buildNativeDataType,
    buildReferenceDataType,
    changeFileType,
    clearData,
    createChart,
    createListForPropertyAndAtrributeSection,
    createSWAProperty,
    expandOrCollapseSummary,
    fileImported,
    getAdminObjects,
    getAdminObjectsForSublocation,
    getExpressionForArrayIRDI,
    getJsonRequestForIRDI,
    getJsonRequestForSearch,
    getJsonResponseForType,
    getKeyLOV,
    getObjects,
    getObjectNames,
    getReleasesExpanded,
    getReleasePreferenceValues,
    getSearchCriteria,
    getSearchCriteriaArrayIRDI,
    getSearchCriteriaForArrayIRDI,
    getSearchCriteriaForHierarchy,
    getSearchCriteriaForIRDI,
    getSearchExpressionForName,
    getSearchCriteriaForTree,
    getSearchCriteriaForType,
    initializeSWA,
    isClassType,
    loadDataForAttributes,
    modifySearchCriteriaForFilter,
    performOperationsForKeyLOVDefinition,
    performOperationsForClassDefinition,
    resetSWAData,
    selectNode,
    selectNodeForNode,
    selectNodeInSecWorkArea,
    selectNodeForPanel,
    setNextPage,
    setSublocation,
    toggleImportMode,
    uploadAndImport,
    updateBreadCrumb,
    updateSelectedReleases
};
