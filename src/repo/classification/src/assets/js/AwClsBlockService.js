// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/*global
 define
 */

/**
 * Defines {@link AwClsBlockService}
 *
 * @module js/AwClsBlockService
 */
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import AwClsAttributeAnnotation from 'viewmodel/AwClsAttributeAnnotationViewModel';
import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import _ from 'lodash';
import $ from 'jquery';


const handleShowMandatory = ( children ) => {
    let result = false;
    let childBlockHasMandatory = false;
    _.forEach( children, ( child ) => {
        if( child.type !== 'Block' && child.vmps ) {
            if( child.vmps[0].isRequired ) {
                result = child.vmps[0].isRequired;
            }
        } else if( child.type === 'Block' ) {
            childBlockHasMandatory = handleShowMandatory( child.children );
        }
    } );
    return result || childBlockHasMandatory;
};

/**
 * render function for AwClsBlock
 * @param {*} props props
 * @returns {JSX.Element} react component
 */
export const awClsBlockServiceRenderFunction = ( props ) => {
    const { attribute, classifyState, responseState, viewModel, ...prop } = props;
    let { data } = viewModel;

    let propDetails = prop.propDetails;
    let level = propDetails.level;
    let view = classifyState.value.panelMode;

    const renderAttributeInt = ( attribute, level, parentDetails ) => {
        const attrname = attribute.name;

        if ( attribute.type !== 'Block' && attribute.visible ) {
            return (
                <AwClsAttributeAnnotation attr={attribute} attrname={attrname}
                    propDetails= {parentDetails ? parentDetails : propDetails}
                    classifyState={classifyState}
                    responseState={responseState}>
                </AwClsAttributeAnnotation>
            );
        }
        if ( attribute.type === 'Block' ) {
            return (
                renderArray( attribute.children, level )
            );
        }
    };

    const renderCardinalBlock = ( attribute, level ) => {
        var cardinalBlock = attribute.cardinalController;
        var parentDetails = _.clone( propDetails );
        parentDetails.cardinalAttribute = attribute;
        var isVisible = attribute.visible || cardinalBlock.visible;
        let isTableViewVisible = props.selectedBlockAttr.blockId === attribute.blockId && props.selectedBlockAttr.tableView;
        var context = {
            attribute : attribute,
            selectedBlockAttr: props.selectedBlockAttr,
            gridProvider: props.blockGridProvider,
            isTableViewVisible: isTableViewVisible,
            classifyState: props.classifyState
        };

        return (
            <div>
                { isVisible && <ul className='aw-ui-tree' >
                    <div className='aw-clspanel-block' onMouseEnter={ ( event ) => selectBlock( event ) }>
                        <div className='aw-clspanel-cardinalBlock' title={ attribute.name }>
                            <AwCommandPanelSection caption={ attribute.name } collapsed={ !attribute.propExpanded } context={ context } anchor={ data.classifyViewCommands }>
                                {/* Cardinal Property */ }
                                <div className='aw-clspanel-treeValueSection'>
                                    { renderAttributeInt( cardinalBlock, level, parentDetails ) }
                                </div>
                                {/* Cardinal Block. Add block for each instance */ }
                                { attribute.instances &&
                                    <div>
                                        {/* Cardinal Block. In List View.*/ }
                                        { !isTableViewVisible && <ul className='aw-ui-tree' >
                                            { renderArray( attribute.instances, level + 1, attribute ) }
                                        </ul>
                                        }
                                        {/* Cardinal Block. In Table View.*/ }
                                        { isTableViewVisible &&
                                            <AwSplmTable className='aw-clspanel-table' { ...props.blockGridProvider } ></AwSplmTable>
                                        }
                                    </div>
                                }
                            </AwCommandPanelSection>
                        </div>
                    </div>
                </ul>
                }
            </div >
        );
    };

    const renderPolymorphicBlock = ( prop, level, parentAttribute ) => {
        var parentDetails = _.clone( propDetails );
        if ( parentAttribute.cardIndex ) {
            parentDetails.cardinalAttribute = parentAttribute;
        }
        return (
            <div className='aw-clspanel-treeValueSection'>
                { renderAttributeInt( prop, level, parentDetails ) }
            </div>
        );
    };

    const renderAttribute = ( attribute, level, parentAttribute ) => {
        var parentDetails = _.clone( propDetails );
        if ( parentAttribute.cardIndex ) {
            parentDetails.cardinalAttribute = parentAttribute;
        }
        if ( attribute.type !== 'Block' && ( !attribute.isCardinalControl || attribute.isCardinalControl !== '' ) ) {
            return (
                renderAttributeInt( attribute, level, parentDetails )
            );
        }
        if ( attribute.type === 'Block' ) {
            return (
                renderBlock( attribute, level )
            );
        }
    };

    const selectBlock = ( event ) => {
        var parentBlks = document.getElementsByClassName( 'aw-clspanel-parentHover' );
        for ( var i = 0; i < parentBlks.length; i++ ) {
            var parentBlk = parentBlks[ i ];
            parentBlk.className = 'aw-clspanel-block ng-scope';
        }
        var current = document.getElementsByClassName( 'aw-clspanel-childHover' );
        if ( current && current[ 0 ] ) {
            current[ 0 ].className = current[ 0 ].className.replace( ' aw-clspanel-childHover', '' );
        }
        var elem = $( event.target ).closest( '.aw-ui-tree' );
        if ( elem.length > 0 ) {
            var parentElem = $( elem ).closest( '.aw-clspanel-block' );
            if ( parentElem.length > 0 ) {
                var parentClass = parentElem[ 0 ].className;
                if ( parentClass.indexOf( 'aw-clspanel-parentHover' ) < 0 ) {
                    parentElem[ 0 ].className += ' aw-clspanel-parentHover';
                }
                elem[ 0 ].firstElementChild.className += ' aw-clspanel-childHover';
            } else {
                //top level
                elem[ 0 ].firstElementChild.className += ' aw-clspanel-parentHover';
            }
        }
    };

    const renderArray = ( attributes, level, parentAttribute ) => {
        const attrs = Object.entries( attributes ).map( ( [ key, attr ], index ) => {
            if ( attr.isCardinalControl !== 'true' ) {
                return (
                    <div key={attr.id} >
                        { renderAttribute( attr, level, parentAttribute ) }
                    </div>
                );
            }
        } );
        return (
            <div>{ attrs }</div>
        );
    };

    const renderBlock = ( attribute, level ) => {
        var isCardinalBlock = Boolean( attribute.cardinalController && attribute.cardinalController.id !== undefined );

        const isMandatory = handleShowMandatory( attribute.children );
        const showMandatory = classifyState.selectedClass.showMandatory;

        var isVisible = ( !showMandatory || isMandatory && showMandatory ) && attribute.visible;
        var polymorphicProp = attribute.polymorphicTypeProperty;

        return (
            <div>
                { !isCardinalBlock && <div>
                    { isVisible && <ul className='aw-ui-tree' >
                        <div className='aw-clspanel-block' onMouseEnter={( event )=> selectBlock( event )}>
                            <AwCommandPanelSection caption={attribute.name} collapsed={!attribute.propExpanded} context={attribute}>
                                { polymorphicProp && renderPolymorphicBlock( polymorphicProp, level, attribute ) }
                                <div className='aw-clspanel-treeValueSection'>
                                    { renderArray( attribute.children, level + 1, attribute ) }
                                </div>
                            </AwCommandPanelSection>
                        </div>
                    </ul> }
                </div> }
                {isCardinalBlock && renderCardinalBlock( attribute, level )}
            </div>
        );
    };

    return (
        <div>
            { renderBlock( attribute, level ) }
        </div>
    );
};
