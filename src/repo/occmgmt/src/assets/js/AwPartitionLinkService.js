// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/anchor-is-valid*/

/**
 * This is a service file for Partition link
 *
 * @module js/AwPartitionLinkService
 */
var exports = {};

export const awPartitionLinkRenderFunction = ( props ) => {
    let { ...prop } = props;
    let { filter } = prop;
    return (
        <a>{filter.name}</a>
    );
};

export default exports = {
    awPartitionLinkRenderFunction
};

