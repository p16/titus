# Quick start
Titus is easy to install and run. We encourage developers to install Titus locally themselves It should feel easy to navigate around, start, and stop. Before we go further however, let us ensure you have all of the prerequesites installed. 

You will need the latest stable versions of [Node.js](), and [Docker](). Both of these should be trivial to install and do not require any special setup.

## Clone the repo
To kick everything off, fork [Titus]() on Github, it will be easier to maintain your own fork as Titus is designed to diverge, it is unlikely.

Once you have your fork, clone a copy of it locally,

```sh
git clone https://github.com/<your-fork>/titus.git
```

## Install dependencies
Since Titus is a Lerna mono repo, there are two ways to kick of an install. While in the root folder of the project, run the following npm command,

```sh
npm install
```

or, should you have Lerna installed globally, you can also run,

```sh
lerna bootstrap
```

In both cases dependencies are installed for all constiuent parts of the repository.

## Create default environment files
Titus uses `.env` files in each package to control various configuration. In all cases there are `.sample.env` files documenting what values should be in the `.env` file proper.

However, before the stack can be ran, the actual `.env` files need to be created and populated. A convenience script exists to automate this process. 

To generate a default set of `.env` files for all packages, run the following command in the root of the project,

```sh
npm run create:env
```

### Configure Auth (Optional) 
Titus supports any auth provider that is OIDC compliant. In order to connect with Auth0 or any other OIDC provider few environment variables need to be defined.

Both the frontend and backend are able to use the standard OIDC to connect to Auth0 or other OIDC compliant providers. Use the following variables instead of the above mentioned:

For the frontend Auth0 configuration:
```
REACT_APP_OIDC_AUTHORITY
REACT_APP_OIDC_CLIENT_ID
```

For the backend Auth0 configuration:
```
REACT_APP_AUTH0_DOMAIN
REACT_APP_AUTH0_CLIENT_ID
REACT_APP_AUTH0_AUDIENCE
```

For backend app:

```
AUTH0_DOMAIN
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET
AUTH0_AUDIENCE
```

## Run the stack
Titus runs locally on Docker. Ensure Docker has started on your machine before running the stack. To run the full stack, in the root of the project, run,

```sh
npm run start:kitchen-sink
```

Running the command below,

```sh
docker ps
```

Should produce a slightly more detailed version of the output below,

```sh
CONTAINER ID        IMAGE            PORTS                              NAMES
5fae4357593d        docker_api       0.0.0.0:5000->5000/tcp, 8080/tcp   docker_api_1
d119b3262ff7        docker_titus-db  0.0.0.0:5432->5432/tcp             docker_titus-db_1
9970ccaaee48        mrister/fake-s3  0.0.0.0:4569->4569/tcp             docker_s3_1
ddbe5f6e0913        adminer          0.0.0.0:8080->8080/tcp             docker_adminer_1
0470eec65534        redis:alpine     0.0.0.0:6379->6379/tcp             docker_redis_1
```

If all of the services above are listed, you are now free running Titus! Congratulations.

### Stopping the stack
You can can also stop the stack by running

```
npm run stop:kitchen-sink
```

Which will stop all applicable docker containers and services.