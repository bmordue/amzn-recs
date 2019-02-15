#!/bin/sh

PWD=$(pwd)
docker run \
    --detach \
    --publish=7473:7473 \
    --publish=7474:7474 --publish=7687:7687 \
    --volume=$PWD/neo4j/data:/data \
    --volume=$PWD/neo4j/logs:/logs \
    --env NEO4J_AUTH=none \
    neo4j:3.1
