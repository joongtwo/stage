// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0LogicalObjectService
 */
import AwRadioButton from 'viewmodel/AwRadiobuttonViewModel';
import AwWidget from 'viewmodel/AwWidgetViewModel';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import msgService from 'js/messagingService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import $ from 'jquery';

/** The exports */
var exports = {};

/** C++ keywords */
var cppKeywords = [ 'asm', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'const_cast',
    'continue', 'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'export',
    'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable', 'namespace',
    'new', 'operator', 'private', 'protected', 'public', 'register', 'reinterpret_cast', 'return', 'short',
    'signed', 'sizeof', 'static', 'static_cast', 'switch', 'this', 'throw', 'true', 'try', 'typeid', 'union',
    'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while', 'none'
];

/** Invalid operation names */
var opNames = [ 'Struct', 'TypeDef', 'Template' ];

/**
 * Set the active view
 *
 * @param {Data} data - The data of the viewModel
 * @param {String} view - The view to be set to
 */
export let setActiveView = function( data, view ) {
    data.activeView = view;
};

/**
    * Set the root object
    *
    * @param {Data} data - The qualified data of the viewModel
    * @return {Data} newParentSearchInput - modified data.
    */
export let setRootObject = function( data ) {
    const { _parentSearchInput } = data;
    let newParentSearchInput = { ..._parentSearchInput };

    const { rootSelectionData } = data;
    if( rootSelectionData && rootSelectionData.selected && rootSelectionData.selected.length === 1 ) {
        if ( data.rootSet.length > 0 ) {
            data.rootSet = [];
        }
        data.rootSet.push( rootSelectionData.selected[ 0 ].object );
        data.dataProviders.rootSetProvider.update( data.rootSet );
        data.dataProviders.rootSetProvider.selectNone();
        newParentSearchInput.searchCriteria.root = data.rootSet[0].props.type_name.dbValues[0];
    }
    return { _parentSearchInput: newParentSearchInput };
};

/**
    * Set the parent object
    *
    * @param {Data} data - The qualified data of the viewModel
    * @return {Data} newRootSearchInput - modified data.
    */
export let setParentObject = function( data ) {
    const { _rootSearchInput } = data;
    let newRootSearchInput = { ..._rootSearchInput };

    const { parentSelectionData } = data;
    if( parentSelectionData && parentSelectionData.selected && parentSelectionData.selected.length === 1 ) {
        if ( data.parentSet.length > 0 ) {
            data.parentSet = [];
        }
        data.parentSet.push( parentSelectionData.selected[ 0 ].object );
        data.dataProviders.parentSetProvider.update( data.parentSet );
        data.dataProviders.parentSetProvider.selectNone();
        newRootSearchInput.searchCriteria.parentLO = data.parentSet[0].props.type_name.dbValues[0];
    }
    return { _rootSearchInput: newRootSearchInput };
};

/**
 * Set the Logical Object to be selected
 *
 * @param {Object} obj - the Logical Object to be selected
 */
export let setObjectToSelect = function( obj ) {
    var logicalObject = exports.getCtx( 'logicalObject' );
    let newLogicalObject = { ...logicalObject };
    if( newLogicalObject ) {
        newLogicalObject.toSelect = obj ? [ obj ] : [];
    }
    appCtxSvc.updateCtx( 'logicalObject', newLogicalObject );
};

/**
 * Validate the logical object
 *
 * @param {Data} data - the data of the ViewModel
 * @return {boolean} true if OK to save, false if params are invalid
 */
export let validate = function( data ) {
    exports.setObjectToSelect();

    if( !/^\w+$/.test( data.internalName.dbValue ) ) {
        showError( data.i18n.nameCharError, [ data.i18n.internalName ] );
        return false;
    }

    if( cppKeywords.indexOf( data.internalName.dbValue ) >= 0 ) {
        showError( data.i18n.nameCppError, [ data.i18n.internalName, data.internalName.dbValue ] );
        return false;
    }

    if( opNames.indexOf( data.internalName.dbValue ) >= 0 ) {
        showError( data.i18n.nameOpError, [ data.i18n.internalName, data.internalName.dbValue ] );
        return false;
    }

    var matched = data.name.dbValue.match( /[<>"'&]/ );
    if( matched && matched.length > 0 ) {
        showError( data.i18n.xmlCharError, [ data.i18n.name, matched[ 0 ] ] );
        return false;
    }

    if( /^\s+|\s+$/.test( data.name.dbValue ) ) {
        showError( data.i18n.trailingSpaceError, [ data.i18n.name ] );
        return false;
    }

    if( /^\s+|\s+$/.test( data.description.dbValue ) ) {
        showError( data.i18n.trailingSpaceError, [ data.i18n.description ] );
        return false;
    }

    if( /[\t]/.test( data.name.dbValue ) ) {
        showError( data.i18n.tabError, [ data.i18n.name ] );
        return false;
    }

    if( /[\t]/.test( data.description.dbValue ) ) {
        showError( data.i18n.tabError, [ data.i18n.description ] );
        return false;
    }

    eventBus.publish( 'awLogicalObject.saveEvent' );
    return true;
};

/**
 * Add a segment into data.segments
 *
 * @param {Data} data - the data of the ViewModel
 * @param {CommandContext} commandContext - the command context
 * @param {panelName} panelName - the panel name
 * @return {Data} newData - modified data.
 */
export let addSegment = function( data, commandContext, panelName ) {
    const { loContext } = data;
    let newLoContext = { ...loContext };
    var logicalObjectID = 'IncludedLogicalObjects';
    var newData = _.clone( data );

    if( !newLoContext.segment && commandContext.segment ) {
        newData = commandContext;
        newLoContext = commandContext.loContext;
    }

    if( newData && newLoContext.segment && newLoContext.segment.props ) {
        if( !newLoContext.segments ) {
            newLoContext.segments = [];
        }

        setLogicalObject( newData );
        setSegmentEnabled( getLastSegment( newLoContext.segments ), false );
        setSegmentEditable( newLoContext.segment, true );
        setSegmentSource( newData );
        setPropertyLabels( newLoContext.segment.props.fnd0Direction, newData.i18n );

        newLoContext.segment.index = newLoContext.segments.length + 1;
        newLoContext.segment.caption = newData.i18n.segment.replace( '{0}', newLoContext.segment.index );
        newData.addSegmentCaption = newData.i18n.segment.replace( '{0}', newLoContext.segment.index + 1 );

        if( panelName === logicalObjectID ) {
            if( newLoContext.segment.props.fnd0IncludedLO.dbValue === null ||
                newLoContext.segment.props.fnd0IncludedLO.dbValue === undefined ||
                newLoContext.segment.props.fnd0IncludedLO.dbValue === false ) {
                newLoContext.segment.props.fnd0IncludedLO.dbValue = true;
            }

            if( newLoContext.segment.props.fnd0OwningLoTypeName.dbValue === null ||
                newLoContext.segment.props.fnd0OwningLoTypeName.dbValue === undefined ||
                newLoContext.segment.props.fnd0OwningLoTypeName.dbValue === false ) {
                newLoContext.segment.props.fnd0OwningLoTypeName.dbValue = newData.logicalObjectInternalName;
            }
        }

        newLoContext.segments.push( newLoContext.segment );
        setExistingSegment( newData );
    }
    return { loContext: newLoContext, logicalObject: newData.logicalObject,
        logicalObjectName: newData.logicalObjectName, logicalObjectInternalName: newData.logicalObjectInternalName,
        addSegmentCaption: newData.addSegmentCaption, caption: newData.caption, existingSegmentCount: newData.existingSegmentCount };
};

/**
 * Remove a segment from data.segments
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Data} newData - modified data.
 */
export let removeSegment = function( data ) {
    const { loContext } = data;
    let newLoContext = { ...loContext };
    var newData = _.clone( data );
    if( newLoContext.segments && newLoContext.segments.length > 1 ) {
        newData.addSegmentCaption = newLoContext.segments.pop().caption;
        newLoContext.segment = getLastSegment( newLoContext.segments );
        newData.segmentRemoved = true;
        setSegmentEnabled( newLoContext.segment, true );
    }
    return { loContext: newLoContext, addSegmentCaption: newData.addSegmentCaption, segmentRemoved: newData.segmentRemoved };
};

/**
 * Clear the current segment
 *
 * @param {Segment} segment - the data of the ViewModel
 * @param {loContext} loContext - the data of the ViewModel
 */
export let clearSegment = function( segment, loContext ) {
    let loCtx = { ...loContext.getValue() };
    let vmo = loCtx.segments[segment.index - 1];
    if( vmo && vmo.existing ) {
        vmo.existing = false;
    } else if ( vmo ) {
        setDbAndUiValue( vmo.props.fnd0RelationOrReference, '' );
        setDbAndUiValue( vmo.props.fnd0DestinationType, '' );
        if( vmo.props.fnd0DestinationCriteria !== undefined ) {
            setDbAndUiValue( vmo.props.fnd0DestinationCriteria, '' );
        }
    }
    loCtx.segments[segment.index - 1] = vmo;
    loContext.update( loCtx );
};

/**
 * Clear the current segment
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Data} newData - modified data.
 */
export let clearAllSegments = function( data ) {
    const { loContext } = data;
    let newLoContext = { ...loContext };

    if( newLoContext.segment && newLoContext.segment.existing ) {
        newLoContext.segment.existing = false;
    } else if ( newLoContext.segment ) {
        setDbAndUiValue( newLoContext.segment.props.fnd0RelationOrReference, '' );
        setDbAndUiValue( newLoContext.segment.props.fnd0DestinationType, '' );
        if( newLoContext.segment.props.fnd0DestinationCriteria !== undefined ) {
            setDbAndUiValue( newLoContext.segment.props.fnd0DestinationCriteria, '' );
        }
    }
    newLoContext.segments = [];
    return { loContext: newLoContext };
};

/**
 * Get the Traversal Path
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Object} the traversal path
 */
export let getTraversalPath = function( data ) {
    var path = [];
    for( var i = 0; i < data.loContext.segments.length; i++ ) {
        var seg = data.loContext.segments[ i ];
        var relOrRef = seg.props.fnd0RelationOrReference;
        path.push( {
            propertyName: relOrRef.dbValue,
            propertyType: '',
            destinationType: seg.props.fnd0DestinationType.dbValue,
            direction: seg.props.fnd0Direction.dbValue ? 'forward' : 'reverse',
            destinationObjectCriteria: seg.props.fnd0DestinationCriteria.dbValue
        } );
    }
    return path;
};

/**
 * Check for special characters
 *
 * @param {Data} data - the data of the ViewModel
 * @param {idName} data - the name of the Add Panel
 * @param {idValue} data - the Member Id or Logical Object Id
 * @return a boolean if it contains a special character or not.
 */
export let specialCharacterCheck = function( data, idName, idValue ) {
    if( /^[a-zA-Z0-9_]*$/.test( idValue ) === false ) {
        if( idName === 'Add Member' || idName === 'Edit Member' ) {
            showError( data.i18n.addEntryMemberSpecialCharacterError );
        } else if( idName === 'Add Included Logical Object' ) {
            showError( data.i18n.addEntryLogicalObjectSpecialCharacterError );
        }
        return false;
    }

    if( idName === 'Add Member' ) {
        eventBus.publish( 'awLogicalObject.addMemberEvent' );
    } else if( idName === 'Add Included Logical Object' ) {
        eventBus.publish( 'awLogicalObject.addIncludedLogicalObjectEvent' );
    } else if( idName === 'Edit Member' ) {
        eventBus.publish( 'awLogicalObject.saveMember' );
    }

    return true;
};

/**
 * Add property definition
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Data} newData - modified data.
 */
export let addPropDef = function( data ) {
    var propTypeName = '';
    const newData = _.clone( data );
    if( newData && newData.propDef ) {
        setLogicalObject( newData );
        newData.propDef.props.fnd0RootOrMemberID.isEditable = true;
        newData.propDef.props.fnd0MemberProperties.isEditable = true;

        if( newData && newData.logicalObject && newData.logicalObject.props && newData.logicalObject.props.type_name ) {
            propTypeName = getDbValue( newData.logicalObject.props.type_name );
        }
        newData.propDef.props.fnd0OwningType.dbValue = newData.logicalObject ? propTypeName : '';
        newData.propDef.props.fnd0OwningType.isEditable = true;
        newData.propDef.props.fnd0OwningType.valueUpdated = true;
    }
    return  newData;
};

/**
 * Update property definition
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Data} newData - modified data.
 */
export let updatePropDef = function( data ) {
    const newData = _.clone( data );
    if( newData && newData.propDef ) {
        newData.propDef.props.fnd0MemberProperties.dbValue = [];
        newData.propDef.props.fnd0MemberProperties.displayValsModel = [];
        newData.propDef.props.fnd0MemberProperties.displayValues = [];
    }
    return newData;
};

/**
 * Get property definitions
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Object} the property definitions
 */
export let getPropDefs = function( data ) {
    const newData = _.clone( data );
    var rootOrMember = newData.propDef.props.fnd0RootOrMemberID;
    var memberProp = newData.propDef.props.fnd0MemberProperties;

    var id = rootOrMember.dbValue;
    var props = memberProp.dbValue;
    newData.propDef0 = { presentedPropertyName: id + '_' + props[ 0 ] };
    newData.propDefs = [];

    for( var i = 0; i < props.length; i++ ) {
        var prop = props[ i ];

        if( !propExist( newData.propDefs, prop ) ) {
            newData.propDefs.push( {
                rootOrMemberName: id,
                sourcePropertyName: prop,
                presentedPropertyName: '',
                displayName: ''
            } );
        }
    }

    return newData.propDefs;
};

/**
 * Confirm delete selected logical object, members, or presented properties
 *
 * @param {Object} data - the data in ViewModel
 * @returns {Promise} the promise
 */
export let confirmDeleteLogicalObject = function( data ) {
    var deferred = AwPromiseService.instance.defer();

    setLogicalObject( data );
    setMembersOrProps( data );

    if( data.logicalObject ) {
        if( data.membersOrProps.length === 0 ) {
            data.toDelete = '"' + data.logicalObjectName + '"';
        } else if( data.membersOrProps.length === 1 ) {
            data.toDelete = '"' + data.membersOrProps[ 0 ] + '"';
        } else {
            data.toDelete = data.i18n.selections.replace( '{0}', data.membersOrProps.length );
        }

        showDeleteWarning( data, deferred );
    }

    return deferred.promise;
};

/**
 * Get the context
 *
 * @param {String} ctxName - the context name
 * @return {Object} the context
 */
export let getCtx = function( ctxName ) {
    return appCtxSvc.getCtx( ctxName );
};

/**
 * Search LogicalObject
 *
 * @param {String} searchString - the search string
 */
export let searchLogicalObject = function( searchString ) {
    var search = exports.getCtx( 'search' );
    let newSearch = { ...search };
    if( newSearch && newSearch.criteria ) {
        newSearch.criteria.searchString = searchString;
    }
    appCtxSvc.updateCtx( 'search', newSearch );

    eventBus.publish( 'primaryWorkarea.reset' );
};

/**
 * Update Destination Type and/or Destination Criteria
 * if RelationOrReference LOV Value is changed
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Data} newSegment - modified data.
 */
export let updateDestTypeAndCriteria = function( data ) {
    const { loContext } = data;
    let newLoContext = { ...loContext };

    if( data && newLoContext.segment && newLoContext.segment.props.fnd0Direction.dbValue ) {
        if( newLoContext.segment.props.fnd0DestinationType !== undefined && newLoContext.segment.props.fnd0DestinationType.valueUpdated === true ) {
            setDbAndUiValue( newLoContext.segment.props.fnd0DestinationType, '' );
        }

        if( newLoContext.segment.props.fnd0DestinationCriteria !== undefined && newLoContext.segment.props.fnd0DestinationCriteria.valueUpdated === true ) {
            setDbAndUiValue( newLoContext.segment.props.fnd0DestinationCriteria, '' );
        }
    }
    return { loContext: newLoContext };
};

/**
 * Update Destination Criteria if DestinationType LOV Value is changed
 *
 * @param {Data} data - the data of the ViewModel
 * @return {Data} newSegment - modified data.
 */
export let updateRelOrRefAndDestCriteria = function( data ) {
    const { loContext } = data;
    let newLoContext = { ...loContext };

    if( data && newLoContext.segment ) {
        if( newLoContext.segment.props.fnd0Direction.dbValue ) {
            if( newLoContext.segment.props.fnd0DestinationCriteria !== undefined && newLoContext.segment.props.fnd0DestinationCriteria.valueUpdated === true ) {
                setDbAndUiValue( newLoContext.segment.props.fnd0DestinationCriteria, '' );
            }
        } else {
            if( newLoContext.segment.props.fnd0RelationOrReference !== undefined && newLoContext.segment.props.fnd0RelationOrReference.valueUpdated === true ) {
                setDbAndUiValue( newLoContext.segment.props.fnd0RelationOrReference, '' );
            }

            if( newLoContext.segment.props.fnd0DestinationCriteria !== undefined && newLoContext.segment.props.fnd0DestinationCriteria.valueUpdated === true ) {
                setDbAndUiValue( newLoContext.segment.props.fnd0DestinationCriteria, '' );
            }
        }
    }
    return { loContext: newLoContext };
};

/**
 * Update Flag to indicate if DestinationType is Fnd0LogicalObject
 *
 * @param {Data} loContext - the data of the ViewModel
 * @param {Data} eventData - the additional event data
 * @return {Data} newSegment - modified data.
 */
export let updateDestType = function( isDestTypeLO, eventData ) {
    var newIsDestTypeLO = _.clone( isDestTypeLO );

    if ( eventData.selectedObjects[0].lovValueProp === 'fnd0InternalName' ) {
        if ( eventData.selectedObjects[0].lovRowValue.uid.lastIndexOf( ':' ) === 5 ) {
            newIsDestTypeLO = true;
        } else{
            newIsDestTypeLO = false;
        }
    }
    return newIsDestTypeLO;
};

/**
 * Get the member definition map
 *
 * @param {Object} data - the data
 * @return {Object} the member definition map
 */
export let getMemberDefMap = function( data ) {
    var map = {};
    var selected = exports.getCtx( 'selected' );
    if( data.logicalObject && selected && selected.props.fnd0TraversalSegments ) {
        map[ selected.props.fnd0PropertyName.dbValue ] = {
            memberPropertyName: data.memberId.dbValue,
            displayName: data.displayName.dbValue,
            retrieveClassificationData: data.retrieveClassificationData.dbValue,
            traversalPath: exports.getTraversalPath( data )
        };
    }

    return map;
};

/**
 * Show error message with optional params
 *
 * @param {Sting} message - the message
 * @param {String} params - optional params
 */
function showError( message, params ) {
    var msg = message;
    if( params && params.length > 0 ) {
        for( var i = 0; i < params.length; i++ ) {
            msg = msg.replace( '{' + i + '}', params[ i ] );
        }
    }

    msgService.showError( msg );
}

/**
 * Show delete warning message
 *
 * @param {Object} data - the data
 * @param {Object} deferred - the deferred
 */
function showDeleteWarning( data, deferred ) {
    var msg = data.i18n.deleteConfirmation.replace( '{0}', data.toDelete );
    data.confirmDelete = '';
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
            deferred.resolve( data.confirmDelete = false );
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.delete,
        onClick: function( $noty ) {
            $noty.close();
            deferred.resolve( data.confirmDelete = true );
        }
    } ];
    msgService.showWarning( msg, buttons );
}

/**
 * Set the segment as editable or not
 *
 * @param {Segment} segment - the segment
 * @param {boolean} editable - set as editable or not
 */
function setSegmentEditable( segment, editable ) {
    if( segment ) {
        segment.props.fnd0Direction.isEditable = editable;
        segment.props.fnd0RelationOrReference.isEditable = editable;
        segment.props.fnd0DestinationType.isEditable = editable;
        segment.props.fnd0DestinationCriteria.isEditable = editable;
    }
}

/**
 * Set the segment as enabled or not
 *
 * @param {Segment} segment - the segment
 * @param {boolean} enabled - set as enabled or not
 */
function setSegmentEnabled( segment, enabled ) {
    if( segment ) {
        segment.props.fnd0Direction.isEnabled = enabled;
        segment.props.fnd0RelationOrReference.isEnabled = enabled;
        segment.props.fnd0DestinationType.isEnabled = enabled;
        if( segment.props.fnd0DestinationCriteria !== undefined ) {
            segment.props.fnd0DestinationCriteria.isEnabled = enabled;
        }
    }
}

/**
 * Set the property labels
 *
 * @param {Object} prop - the property
 * @param {Object} i18n - the i18n object
 */
function setPropertyLabels( prop, i18n ) {
    if( prop ) {
        prop.dbValue = true;
        prop.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
        prop.propertyRadioTrueText = i18n.forward;
        prop.propertyRadioFalseText = i18n.backward;
    }
}

/**
 * Get the last segment
 *
 * @param {Segments} segments - the data of the ViewModel
 * @returns {Segment} the last segment
 */
function getLastSegment( segments ) {
    if( segments && segments.length > 0 ) {
        return segments[ segments.length - 1 ];
    }
    return null;
}

/**
 * Set the segment source
 *
 * @param {Object} data - the data of the ViewModel

 */
function setSegmentSource( data ) {
    var lastSeg = getLastSegment( data.loContext.segments );


    data.loContext.segment.props.fnd0SourceType.dbValue = lastSeg ? lastSeg.props.fnd0DestinationType.dbValue :
        data.logicalObject ? getDbValue( data.logicalObject.props.fnd0RootTypeName ) : '';

    if( data.loContext.segment.props.fnd0SourceType && ( data.loContext.segment.props.fnd0SourceType.valueUpdated === false ||
            data.loContext.segment.props.fnd0SourceType.valueUpdated === undefined ) ) {
        data.loContext.segment.props.fnd0SourceType.valueUpdated = true;
    }

    if( data.loContext.segment.props.fnd0Direction && ( data.loContext.segment.props.fnd0Direction.valueUpdated === false ||
            data.loContext.segment.props.fnd0Direction.valueUpdated === undefined ) ) {
        data.loContext.segment.props.fnd0Direction.valueUpdated = true;
    }

    if( data.loContext.segment.props.fnd0IncludedLO && ( data.loContext.segment.props.fnd0IncludedLO.valueUpdated === false ||
            data.loContext.segment.props.fnd0IncludedLO.valueUpdated === undefined ) ) {
        data.loContext.segment.props.fnd0IncludedLO.valueUpdated = true;
    }

    if( data.loContext.segment.props.fnd0OwningLoTypeName && ( data.loContext.segment.props.fnd0OwningLoTypeName.valueUpdated === false ||
            data.loContext.segment.props.fnd0OwningLoTypeName.valueUpdated === undefined ) ) {
        data.loContext.segment.props.fnd0OwningLoTypeName.valueUpdated = data.logicalObjectInternalName;
    }
}

/**
 * Set the current logical object
 *
 * @param {Object} data - the data of the ViewModel
 */
function setLogicalObject( data ) {
    var selected = exports.getCtx( 'selected' );
    var logicalObjectNameSplit = '';
    if( !( selected && selected.props.fnd0RootTypeName ) ) {
        selected = exports.getCtx( 'pselected' );
    }

    //check if the selected LO object's display string contains (Root:<internal name>)
    if( selected && selected.props ) {
        data.logicalObject = selected;

        if( selected.props.object_string ) {
            logicalObjectNameSplit = getDbValue( selected.props.object_string );
            var openBracketIndex = logicalObjectNameSplit.indexOf( '(' );
            if( openBracketIndex !== -1 ) {
                logicalObjectNameSplit = logicalObjectNameSplit.substring( 0, openBracketIndex ).trim();
            }
        }

        data.logicalObjectName = selected ? logicalObjectNameSplit : '';

        if( selected.props.fnd0InternalName && selected.props.fnd0InternalName.dbValues ) {
            data.logicalObjectInternalName = selected.props.fnd0InternalName.dbValues;
        }
    }
}

/**
 * Set multiselected members or presented properties
 *
 * @param {Object} data - the data of the ViewModel
 */
function setMembersOrProps( data ) {
    var list = [];
    var selected = exports.getCtx( 'selected' );
    var mselected = exports.getCtx( 'mselected' );
    var rowId = getRowId( selected );

    if( rowId ) {
        list.push( rowId );
    }

    if( mselected ) {
        for( var i = 0; i < mselected.length; i++ ) {
            rowId = getRowId( mselected[ i ] );
            if( rowId && list.indexOf( rowId ) === -1 ) {
                list.push( rowId );
            }
        }
    }

    data.membersOrProps = list;
}

/**
 * Get row ID, can be either fnd0PropertyName or fnd0PresentedPropID
 *
 * @param {Object} row - the selected row
 * @returns {Object} the row ID, or null if not exist
 */
function getRowId( row ) {
    if( row && row.props ) {
        return row.props.fnd0PropertyName ? getDbValue( row.props.fnd0PropertyName ) :
            row.props.fnd0PresentedPropID ? getDbValue( row.props.fnd0PresentedPropID ) : null;
    }

    return null;
}

/**
 * Check if a property name already exists in propDefs
 *
 * @param {Object} propDefs - the propDefs
 * @param {String} propName - the property name
 * @returns {Boolean} true if exist
 */
function propExist( propDefs, propName ) {
    for( var i = 0; i < propDefs.length; i++ ) {
        if( propDefs[ i ].sourcePropertyName === propName ) {
            return true;
        }
    }

    return false;
}

/**
 * Get the property dbValue or dbValues[0] even if one of them not exist
 *
 * @param {Object} prop - the property
 * @return {String} the dbValue or dbValues[0]
 */
function getDbValue( prop ) {
    return prop.dbValues && prop.dbValues.length > 0 ? prop.dbValues[ 0 ] : prop.dbValue;
}

/**
 * set the segment from existing data
 *
 * @param {Object} data - the data
 */
function setExistingSegment( data ) {
    var selected = exports.getCtx( 'selected' );

    if( data.logicalObject && selected && selected.props.fnd0TraversalSegments ) {
        if( data.loContext.segment.index === 1 ) {
            data.caption = data.i18n.editMember;
            data.memberId.dbValue = selected.props.fnd0PropertyName.dbValue;
            data.displayName.dbValue = selected.props.fnd0PropertyDisplayName.dbValue;
            data.retrieveClassificationData.dbValue = selected.props.fnd0GetMemberICOData.dbValue;
            data.existingSegmentCount = selected.props.fnd0TraversalSegments.dbValues.length;
        }

        if( data.existingSegmentCount > 0 ) {
            var seg = selected.props.fnd0TraversalSegments.dbValues[ data.loContext.segment.index - 1 ];
            if( typeof seg === 'string' || seg instanceof String ) {
                seg = cdm.getObject( seg );
            }
            data.loContext.segment.props.fnd0Direction.dbValue = getDbValue( seg.props.fnd0Direction ) === '1';
            setDbAndUiValue( data.loContext.segment.props.fnd0RelationOrReference, getDbValue( seg.props.fnd0RelationOrReference ) );
            setDbAndUiValue( data.loContext.segment.props.fnd0DestinationType, getDbValue( seg.props.fnd0DestinationType ) );
            setDbAndUiValue( data.loContext.segment.props.fnd0DestinationCriteria, getDbValue( seg.props.fnd0DestinationCriteria ) );
            data.loContext.segment.props.fnd0RelationOrReference.valueUpdated = true;
            data.loContext.segment.props.fnd0DestinationType.valueUpdated = true;
            data.loContext.segment.props.fnd0DestinationCriteria.valueUpdated = true;
            data.loContext.segment.existing = true;

            if( --data.existingSegmentCount > 0 ) {
                eventBus.publish( 'awLogicalObject.createSegment' );
            }
        }
    }
}

/**
 * Set a segment's property with dbValue and uiValue
 *
 * @param {Object} prop - the property
 * @param {String} value - the value
 */
function setDbAndUiValue( prop, value ) {
    prop.dbValue = value;
    prop.uiValue = value;
}


eventBus.subscribe( 'editHandlerStateChange', function( context ) {
    if( context.state === 'saved' ) {
        var contextObject = exports.getCtx( 'xrtSummaryContextObject' );
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [ contextObject ]
        } );
    }
} );

export const awp0SegmentSectionRenderFunction = ( props ) => {
    let { viewModel, actions, ...prop } = props;
    let {
        traverseSegment
    } = prop;
    let { actionClearSegment } = actions;
    traverseSegment.props.fnd0Direction.name = 'fnd0Direction' + traverseSegment.index;
    traverseSegment.props.fnd0Direction.fielddata.propertyDisplayName = '';
    return (
        <div>
            <AwRadioButton {...traverseSegment.props.fnd0Direction} action={actionClearSegment}></AwRadioButton>
            {
                traverseSegment.props.fnd0Direction.value && <AwWidget {...traverseSegment.props.fnd0RelationOrReference}></AwWidget>
            }
            <AwWidget {...traverseSegment.props.fnd0DestinationType}></AwWidget>
            {
                !traverseSegment.props.fnd0Direction.value && <AwWidget {...traverseSegment.props.fnd0RelationOrReference}></AwWidget>
            }
            <AwWidget {...traverseSegment.props.fnd0DestinationCriteria}></AwWidget>
        </div>
    );
};

/**
 * Set the Selected Object
 *
 * @param {Object} selectionModel - the selectionModel
 * @param {Object} newSelection - the object to select
 */
export let setSelection = function( selectionModel, newSelection ) {
    selectionModel.setSelection( newSelection );
};

export default exports = {
    awp0SegmentSectionRenderFunction,
    setActiveView,
    setRootObject,
    setParentObject,
    setObjectToSelect,
    setSelection,
    validate,
    addSegment,
    removeSegment,
    clearSegment,
    clearAllSegments,
    getTraversalPath,
    specialCharacterCheck,
    addPropDef,
    updatePropDef,
    getPropDefs,
    confirmDeleteLogicalObject,
    getCtx,
    searchLogicalObject,
    updateDestTypeAndCriteria,
    updateRelOrRefAndDestCriteria,
    updateDestType,
    getMemberDefMap
};
