config for DEVOPS
1. git clone https://github.com/infogile/Samvaad-web-app/ 
2. chmode +x ./runme.sh
3. Enter answers
4. cheers!!

config for developers
1. pushd matrix-js-sdk
2. yarn link
3. yarn install
4. popd
5. pushd matrix-react-sdk
6. yarn link
7. yarn link matrix-js-sdk
8. yarn install
9. popd
10. cd samvaad-web-client
11. yarn link matrix-js-sdk
12. yarn link matrix-react-sdk
13. yarn install
14. yarn start
