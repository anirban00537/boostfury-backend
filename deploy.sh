yarn install
yarn prisma:migrate:prod
yarn prisma:generate
yarn build
tmux attach -t buildsocialpostAPI
# yarn start:prod