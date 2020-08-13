#!/bin/sh
OUT=./git-hooks/pre-commit
echo setting git hooks
echo enter ftpserverip
read ftpserver
echo enter ftp username
read ftpuser
echo enter ftp user password
read ftppassword
sudo rm -rf git-hooks
mkdir git-hooks
touch ./git-hooks/pre-commit
cat <<EOF >$OUT
    #!/bin/sh

    echo making Release
    cd samvaad-web-client
    yarn build
    7z a webapp webapp

    ftp -inv $ftpserver << EOF
    user $ftpuser $ftppassword
    put webapp.7z
    bye 
    EOF
    echo upload completed
EOF
chmod +x ./git-hooks/pre-commit
sudo rm -rf ./.git/hooks/pre-commit
ln -s ../../git-hooks/pre-commit .git/hooks

echo git hook setting completed